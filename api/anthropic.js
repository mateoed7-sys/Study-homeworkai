/**
 * Server-side proxy for the Anthropic Messages API.
 *
 * The browser bundle never sees a key: it POSTs here, and this function adds
 * the credential from ANTHROPIC_API_KEY (a normal server env var, not a VITE_
 * one, so Vite never inlines it).
 *
 * This endpoint is public, so it also spends real money if strangers find it.
 * The caps below are the cheap mitigations: the model is pinned here rather
 * than taken from the caller, output and input are bounded, and there is a
 * coarse per-IP throttle. For anything stronger, put Vercel's Deployment
 * Protection in front of the project.
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_CEILING = 4096;
const MAX_MESSAGES = 40;
const MAX_TOTAL_CHARS = 200_000;

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

/** Per-instance and therefore best-effort: a cold start forgets everything. */
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (times.every((at) => now - at >= WINDOW_MS)) hits.delete(key);
    }
  }

  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

function fail(res, status, message) {
  return res.status(status).json({ error: { message } });
}

function readBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body ?? null;
}

/** Returns a cleaned request, or a string describing why it was rejected. */
function validate(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object.';

  const { system, messages, max_tokens: maxTokens, temperature } = body;

  if (system !== undefined && typeof system !== 'string') {
    return '"system" must be a string.';
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return '"messages" must be a non-empty array.';
  }
  if (messages.length > MAX_MESSAGES) {
    return `Too many messages (limit ${MAX_MESSAGES}).`;
  }

  let total = typeof system === 'string' ? system.length : 0;
  for (const message of messages) {
    if (!message || typeof message !== 'object') return 'Each message must be an object.';
    if (message.role !== 'user' && message.role !== 'assistant') {
      return 'Each message role must be "user" or "assistant".';
    }
    if (typeof message.content !== 'string' || message.content.length === 0) {
      return 'Each message needs non-empty string content.';
    }
    total += message.content.length;
  }
  if (total > MAX_TOTAL_CHARS) {
    return 'That request is too large. Trim the notes and try again.';
  }

  return {
    model: MODEL,
    max_tokens: Math.min(
      Math.max(Number.isFinite(maxTokens) ? Math.floor(maxTokens) : 1024, 1),
      MAX_TOKENS_CEILING,
    ),
    temperature: Number.isFinite(temperature) ? Math.min(Math.max(temperature, 0), 1) : 1,
    ...(typeof system === 'string' && system ? { system } : {}),
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'Use POST.');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fail(
      res,
      503,
      'This deployment has no API key yet. In the Vercel dashboard open the project, ' +
        'go to Settings → Environment Variables, add ANTHROPIC_API_KEY with your key, ' +
        'and redeploy.',
    );
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
  if (isRateLimited(ip || 'unknown')) {
    return fail(res, 429, 'Too many requests from this address. Wait a minute and try again.');
  }

  const validated = validate(readBody(req));
  if (typeof validated === 'string') return fail(res, 400, validated);

  let upstream;
  try {
    upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(validated),
    });
  } catch {
    return fail(res, 502, 'Could not reach the Anthropic API from the server. Try again.');
  }

  // Pass the upstream body through untouched; it never contains the key.
  const text = await upstream.text();
  res.status(upstream.status);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  return res.send(text);
}

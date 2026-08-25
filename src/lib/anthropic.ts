/**
 * Client for the Anthropic Messages API, with two modes.
 *
 * dev  — talks straight to api.anthropic.com using VITE_ANTHROPIC_API_KEY from
 *        .env. Convenient locally, where you are the only visitor.
 * prod — POSTs to /api/anthropic, a serverless function that holds the key
 *        server-side. Production bundles therefore contain no credential at
 *        all: `import.meta.env.PROD` is resolved at build time, so the direct
 *        branch (and the key it reads) is dropped by tree-shaking.
 *
 * Set VITE_FORCE_PROXY=1 to exercise the proxy path from a dev server.
 */

export const MODEL = 'claude-sonnet-4-6';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const PROXY_PATH = '/api/anthropic';
const ANTHROPIC_VERSION = '2023-06-01';

export type Role = 'user' | 'assistant';

export interface ApiMessage {
  role: Role;
  content: string;
}

export type ApiErrorKind =
  | 'missing-key'
  | 'auth'
  | 'rate-limit'
  | 'overloaded'
  | 'request'
  | 'network'
  | 'server'
  | 'no-proxy';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

/** 'proxy' in production builds, 'direct' when developing against .env. */
export function apiMode(): 'direct' | 'proxy' {
  return import.meta.env.PROD || import.meta.env.VITE_FORCE_PROXY === '1' ? 'proxy' : 'direct';
}

export function readApiKey(): string {
  const raw = import.meta.env.VITE_ANTHROPIC_API_KEY;
  return typeof raw === 'string' ? raw.trim() : '';
}

function hasLocalKey(): boolean {
  const key = readApiKey();
  return key.length > 0 && key !== 'sk-ant-...';
}

/** True only when running locally with no usable key — the case worth a banner. */
export function needsLocalKey(): boolean {
  return apiMode() === 'direct' && !hasLocalKey();
}

interface AskOptions {
  system: string;
  messages: ApiMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

interface ContentBlock {
  type: string;
  text?: string;
}

/** Sends one request and returns the assistant's text. Throws ApiError on failure. */
export async function askClaude({
  system,
  messages,
  maxTokens = 1400,
  temperature = 1,
  signal,
}: AskOptions): Promise<string> {
  const mode = apiMode();
  const payload = {
    max_tokens: maxTokens,
    temperature,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };

  let request: { url: string; headers: Record<string, string>; body: string };

  if (mode === 'proxy') {
    request = {
      url: PROXY_PATH,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    };
  } else {
    if (!hasLocalKey()) {
      throw new ApiError(
        'missing-key',
        'No API key found. Add VITE_ANTHROPIC_API_KEY to a .env file in the project root, then restart the dev server.',
      );
    }
    request = {
      url: ENDPOINT,
      headers: {
        'content-type': 'application/json',
        'x-api-key': readApiKey(),
        'anthropic-version': ANTHROPIC_VERSION,
        // Required for browser-originated calls to the API.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: MODEL, ...payload }),
    };
  }

  let response: Response;
  try {
    response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      'network',
      mode === 'proxy'
        ? 'Could not reach the server. Check your connection and try again.'
        : 'Could not reach the Anthropic API. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    throw new ApiError(kindForStatus(response.status, mode), await messageForError(response, mode));
  }

  let payloadOut: { content?: ContentBlock[] };
  try {
    payloadOut = await response.json();
  } catch {
    throw new ApiError('server', 'The API returned a response that could not be read.');
  }

  const text = (payloadOut.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('')
    .trim();

  if (!text) {
    throw new ApiError('server', 'The API returned an empty response. Try again.');
  }

  return text;
}

function kindForStatus(status: number, mode: 'direct' | 'proxy'): ApiErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404 && mode === 'proxy') return 'no-proxy';
  if (status === 429) return 'rate-limit';
  // The proxy answers 503 when the server has no key configured.
  if (status === 503 && mode === 'proxy') return 'missing-key';
  if (status === 529) return 'overloaded';
  if (status >= 500) return 'server';
  return 'request';
}

async function messageForError(response: Response, mode: 'direct' | 'proxy'): Promise<string> {
  let detail = '';
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body?.error?.message ?? '';
  } catch {
    detail = '';
  }

  switch (kindForStatus(response.status, mode)) {
    case 'missing-key':
      // The function's own message names the exact setting to change.
      return detail || 'This deployment has no API key configured yet.';
    case 'no-proxy':
      return 'The /api/anthropic endpoint is not running. A production build expects to be served by Vercel — use `npm run dev` locally instead.';
    case 'auth':
      return mode === 'proxy'
        ? "The server's API key was rejected. Update ANTHROPIC_API_KEY in the Vercel project settings and redeploy."
        : 'That API key was rejected. Check VITE_ANTHROPIC_API_KEY in your .env file, then restart the dev server.';
    case 'rate-limit':
      return detail || 'Rate limited. Wait a moment and try again.';
    case 'overloaded':
      return 'The model is overloaded right now. Give it a few seconds and try again.';
    case 'server':
      return 'The API had a server error. Try again in a moment.';
    default:
      return detail
        ? `The API rejected the request: ${detail}`
        : `The API rejected the request (HTTP ${response.status}).`;
  }
}

/** Turns anything thrown by askClaude into a sentence worth showing a student. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Try again.';
}

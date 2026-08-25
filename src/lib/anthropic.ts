/**
 * Thin client for the Anthropic Messages API, called straight from the browser.
 *
 * The key lives in .env as VITE_ANTHROPIC_API_KEY. Vite inlines it into the
 * bundle at build time, so anyone with the built JS can read it — fine for a
 * local study tool, not for anything you deploy publicly.
 */

export const MODEL = 'claude-sonnet-4-6';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
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
  | 'server';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

export function readApiKey(): string {
  const raw = import.meta.env.VITE_ANTHROPIC_API_KEY;
  return typeof raw === 'string' ? raw.trim() : '';
}

/** True when a plausible key is present — not a guarantee that it is valid. */
export function hasApiKey(): boolean {
  const key = readApiKey();
  return key.length > 0 && key !== 'sk-ant-...';
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
  const apiKey = readApiKey();
  if (!hasApiKey()) {
    throw new ApiError(
      'missing-key',
      'No API key found. Add VITE_ANTHROPIC_API_KEY to a .env file in the project root, then restart the dev server.',
    );
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        // Required for browser-originated calls; opts this request out of the
        // SDK's usual "keys don't belong in a client" guard.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      'network',
      'Could not reach the Anthropic API. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    throw new ApiError(kindForStatus(response.status), await messageForError(response));
  }

  let payload: { content?: ContentBlock[] };
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('server', 'The API returned a response that could not be read.');
  }

  const text = (payload.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('')
    .trim();

  if (!text) {
    throw new ApiError('server', 'The API returned an empty response. Try again.');
  }

  return text;
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate-limit';
  if (status === 529) return 'overloaded';
  if (status >= 500) return 'server';
  return 'request';
}

async function messageForError(response: Response): Promise<string> {
  let detail = '';
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body?.error?.message ?? '';
  } catch {
    detail = '';
  }

  switch (kindForStatus(response.status)) {
    case 'auth':
      return 'That API key was rejected. Check VITE_ANTHROPIC_API_KEY in your .env file, then restart the dev server.';
    case 'rate-limit':
      return 'Rate limited by the API. Wait a moment and try again.';
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

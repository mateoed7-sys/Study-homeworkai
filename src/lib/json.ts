/**
 * Models like to wrap JSON in ```json fences or a sentence of preamble.
 * These helpers pull the array back out without letting a bad response crash a tab.
 */

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

const FENCE = /^\s*```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```\s*$/;

/** Strips markdown fences and any prose around the outermost JSON array. */
export function stripToJsonArray(raw: string): string {
  let text = raw.trim();

  const fenced = text.match(FENCE);
  if (fenced) text = fenced[1].trim();

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end > start) text = text.slice(start, end + 1);

  return text.trim();
}

/** Parses a JSON array from a model response, keeping only the items that pass `validate`. */
export function parseJsonArray<T>(raw: string, validate: (item: unknown) => item is T): T[] {
  const cleaned = stripToJsonArray(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ParseError('The response came back malformed.');
  }

  if (!Array.isArray(parsed)) {
    throw new ParseError('The response was not a list.');
  }

  const items = parsed.filter(validate);
  if (items.length === 0) {
    throw new ParseError('The response had no usable entries.');
  }

  return items;
}

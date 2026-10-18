const CHARS_PER_TOKEN = 3.8;

/** A fast token estimate for code and prose: about 3.8 characters per token. */
export function estimateTokens(text: string): number {
  return text ? Math.ceil(text.length / CHARS_PER_TOKEN) : 0;
}

/** One line: whitespace runs, including line breaks, become one space. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

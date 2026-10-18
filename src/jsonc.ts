/**
 * Parses JSON that may hold comments and trailing commas (tsconfig.json, VS Code settings). Strings are copied as
 * they are, so a `//` inside a string is kept. Invalid JSON throws, as JSON.parse does.
 */
export function parseJsonc(text: string): unknown {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      const end = stringEnd(text, i);
      out += text.slice(i, end);
      i = end - 1;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      i = close === -1 ? text.length : close + 1;
    } else if (ch !== ',' || !/^\s*[}\]]/.test(text.slice(i + 1, i + 200))) out += ch;
  }
  return JSON.parse(out);
}

/** The index just after the string that starts at `start`. */
function stringEnd(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
  return i + 1;
}

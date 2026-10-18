/** The shape of parsed JSON or YAML data, compact enough for a prompt: types instead of values, at most 25 keys per object. */

const MAX_DEPTH = 5;
const MAX_KEYS = 25;
/** Above this size only the size is shown. */
export const MAX_SHAPED_CHARS = 25000;

function shapeOf(value: unknown, depth: number): string {
  if (depth > MAX_DEPTH) return 'any';
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const item = shapeOf(value[0], depth + 1);
    return item.includes('\n') ? `[\n${'  '.repeat(depth + 1)}${item}\n${'  '.repeat(depth)}]` : `[${item}]`;
  }
  if (typeof value === 'object') return objectShape(value as Record<string, unknown>, depth);
  return typeof value;
}

function objectShape(value: Record<string, unknown>, depth: number): string {
  const keys = Object.keys(value);
  if (keys.length === 0) return '{}';
  const indent = '  '.repeat(depth + 1);
  const lines = keys.slice(0, MAX_KEYS).map((k) => `${indent}${k}: ${shapeOf(value[k], depth + 1)}`);
  if (keys.length > MAX_KEYS) lines.push(`${indent}... +${keys.length - MAX_KEYS} more fields`);
  return `{\n${lines.join('\n')}\n${'  '.repeat(depth)}}`;
}

/** The skeleton of a data file: its shape, or its size when it is large. */
export function dataSkeleton(kind: 'JSON' | 'YAML', content: string, parsed: unknown): string {
  if (content.length > MAX_SHAPED_CHARS) return `// Large ${kind} (${Math.round(content.length / 1024)} KB)`;
  return `// ${kind} shape\n${shapeOf(parsed, 0)}`;
}

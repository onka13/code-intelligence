/**
 * The shape of parsed JSON or YAML data, compact enough for a prompt whatever the file's size: types instead of values,
 * one item per array with the item count, and repeated entries folded. A 10,000-line list of records is a few lines.
 */

const MAX_DEPTH = 5;
const MAX_KEYS = 25;
/** An object with at least this many keys whose values all have one shape is a dictionary: `{ [key]: shape }`. */
const DICTIONARY_KEYS = 8;
const SAMPLE_KEYS = 3;

const pad = (depth: number) => '  '.repeat(depth);

function shapeOf(value: unknown, depth: number): string {
  if (depth > MAX_DEPTH) return 'any';
  if (value === null) return 'null';
  if (Array.isArray(value)) return arrayShape(value, depth);
  if (typeof value === 'object') return objectShape(value as Record<string, unknown>, depth);
  return typeof value;
}

/** `[string] (3 items)`, or the first item's shape on its own lines when it spans several. */
function arrayShape(value: unknown[], depth: number): string {
  if (value.length === 0) return '[]';
  const item = shapeOf(value[0], depth + 1);
  const count = value.length > 1 ? ` (${value.length} items)` : '';
  return item.includes('\n') ? `[\n${pad(depth + 1)}${item}\n${pad(depth)}]${count}` : `[${item}]${count}`;
}

/** The one shape all values share, when the object has enough keys to be a dictionary rather than a record. */
function dictionaryShape(values: unknown[], depth: number): string | undefined {
  if (values.length < DICTIONARY_KEYS) return undefined;
  const first = shapeOf(values[0], depth + 1);
  return values.every((v) => shapeOf(v, depth + 1) === first) ? first : undefined;
}

function objectShape(value: Record<string, unknown>, depth: number): string {
  const keys = Object.keys(value);
  if (keys.length === 0) return '{}';
  const shared = dictionaryShape(Object.values(value), depth);
  if (shared !== undefined) {
    const sample = keys.slice(0, SAMPLE_KEYS).map((k) => JSON.stringify(k)).join(', ');
    return `{ [key]: ${shared} } (${keys.length} keys: ${sample}, ...)`;
  }
  const lines = keys.slice(0, MAX_KEYS).map((k) => `${pad(depth + 1)}${k}: ${shapeOf(value[k], depth + 1)}`);
  if (keys.length > MAX_KEYS) lines.push(`${pad(depth + 1)}... +${keys.length - MAX_KEYS} more fields`);
  return `{\n${lines.join('\n')}\n${pad(depth)}}`;
}

/** The skeleton of a data file: its shape. */
export function dataSkeleton(kind: 'JSON' | 'YAML', parsed: unknown): string {
  return `// ${kind} shape\n${shapeOf(parsed, 0)}`;
}

import fs from 'node:fs';
import path from 'node:path';
import type { FileRecord } from '../model.js';
import { ParseError, type LanguagePack } from '../packs/pack.js';
import { skeletonOf } from '../text/declarations.js';
import { estimateTokens } from '../tokens.js';
import type { WalkedFile } from '../walk/walk.js';

/** One file's record: parsed by its pack, or listed without symbols when no pack claims it or it is too large. */

export const DEFAULT_MAX_FILE_BYTES = 200_000;

export function packFor(file: string, packs: LanguagePack[]): LanguagePack | undefined {
  return packs.find((p) => p.claims(file));
}

function base(file: WalkedFile, language: string): FileRecord {
  return { path: file.path, language, sizeBytes: file.sizeBytes, mtimeMs: file.mtimeMs, symbols: [], imports: [], skeleton: '', rawTokens: 0, skeletonTokens: 0 };
}

/** A file no pack claims: listed as `other`, never read, never guessed at (CIN-05). */
export function unsupportedRecord(file: WalkedFile): FileRecord {
  return base(file, 'other');
}

/** Parses one file with its pack. A ParseError is recorded on the file (CIN-04); any other error is a bug and propagates. */
export async function parsedRecord(root: string, file: WalkedFile, pack: LanguagePack, maxBytes: number): Promise<FileRecord> {
  const record = base(file, pack.id);
  if (file.sizeBytes > maxBytes) return { ...record, skipped: `larger than ${Math.round(maxBytes / 1000)} KB` };
  const content = fs.readFileSync(path.join(root, file.path), 'utf8');
  record.rawTokens = estimateTokens(content);
  try {
    const parsed = await pack.parse({ path: file.path, content });
    const skeleton = parsed.skeleton ?? skeletonOf(parsed.symbols, content);
    return {
      ...record, symbols: parsed.symbols, skeleton, skeletonTokens: estimateTokens(skeleton),
      imports: parsed.imports.map((i) => ({ ...i, kind: 'unresolved' as const })),
      ...(parsed.declares ? { declares: parsed.declares } : {}),
    };
  } catch (err) {
    if (err instanceof ParseError) return { ...record, error: err.message };
    throw err;
  }
}

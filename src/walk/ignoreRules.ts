import fs from 'node:fs';
import path from 'node:path';
import ignore, { type Ignore } from 'ignore';

/**
 * Folders no scan enters: dependencies, build output, caches, and the platform shells of app frameworks (they hold
 * generated or vendor code). Dot folders and dot files are always left out as well.
 */
export const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules', 'bower_components', 'vendor', 'build', 'dist', 'out', 'coverage', 'bin', 'obj', 'target',
  'pods', 'deriveddata', '__pycache__', 'venv',
  'ios', 'android', 'windows', 'macos', 'linux', 'web', 'public', 'assets', 'static',
]);

/** Files that hold secrets: never read, never listed (dot files such as `.env` are left out already). */
const SECRET_FILES = ignore().add(['*.pem', '*.key', '*.p12', '*.pfx', 'id_rsa', 'id_rsa.*', 'id_ed25519', 'id_ed25519.*', 'credentials.json', 'secrets.json', '*serviceAccountKey*.json']);

const IGNORE_FILES = ['.gitignore', '.contextignore'];

interface Anchored {
  /** For a folder inside the scan: its path relative to the scan root. Empty for the root and the folders above it. */
  scope: string;
  /** For a folder above the scan: the scan root's path relative to it, prepended to every tested path. */
  prefix: string;
  rules: Ignore;
}

function readRules(dir: string): Ignore | undefined {
  const texts = IGNORE_FILES.map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8'));
  return texts.length ? ignore().add(texts.join('\n')) : undefined;
}

/** The folders from the scan root up to the repository root (the first one holding `.git`), nearest first. */
function ancestors(root: string): string[] {
  const found: string[] = [];
  let dir = path.dirname(root);
  let current = root;
  while (!fs.existsSync(path.join(current, '.git')) && dir !== current) {
    found.push(dir);
    current = dir;
    dir = path.dirname(dir);
  }
  return found;
}

/** Ignore rules of one scan: the defaults, every `.gitignore` and `.contextignore` that applies, and the caller's excluded paths. */
export class IgnoreRules {
  private readonly anchored: Anchored[] = [];
  private readonly excluded: string[];

  constructor(private readonly root: string, excludedPaths: string[] = []) {
    this.excluded = excludedPaths.map((p) => p.replace(/\\/g, '/').replace(/^\.?\/+/, '').replace(/\/+$/, '')).filter(Boolean);
    for (const dir of ancestors(root)) this.addFolder(dir);
    this.addFolder(root);
  }

  /** Reads the ignore files of a folder the walk enters. */
  addFolder(absDir: string): void {
    const rules = readRules(absDir);
    if (!rules) return;
    const above = !absDir.startsWith(this.root);
    const posix = (p: string) => p.replace(/\\/g, '/');
    this.anchored.push({ scope: above ? '' : posix(path.relative(this.root, absDir)), prefix: above ? posix(path.relative(absDir, this.root)) : '', rules });
  }

  /** Whether a path relative to the scan root is left out. */
  ignores(relPath: string, isDir: boolean): boolean {
    const name = relPath.split('/').pop() as string;
    if (name.startsWith('.')) return true;
    if (isDir && DEFAULT_IGNORED_DIRS.has(name.toLowerCase())) return true;
    if (!isDir && SECRET_FILES.ignores(name)) return true;
    if (this.excluded.some((ex) => relPath === ex || relPath.startsWith(`${ex}/`))) return true;
    return this.anchored.some((a) => this.matches(a, relPath, isDir));
  }

  private matches(a: Anchored, relPath: string, isDir: boolean): boolean {
    if (a.scope && !relPath.startsWith(`${a.scope}/`)) return false;
    const local = a.scope ? relPath.slice(a.scope.length + 1) : a.prefix ? `${a.prefix}/${relPath}` : relPath;
    return a.rules.ignores(isDir ? `${local}/` : local);
  }
}

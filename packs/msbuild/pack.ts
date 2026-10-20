import path from 'node:path';
import type { DeclaredDependency } from '../../src/model.js';
import { ParseError, type LanguagePack, type ParsedFile, type RawImport, type Resolution, type ResolveInput } from '../../src/packs/pack.js';
import { descendants, parseXml, type XmlElement } from './xml.js';

/**
 * .NET manifests: a `.csproj` (and a shared `.props` or `.targets` file such as Directory.Build.props) declares its
 * `PackageReference` entries as dependencies and its `ProjectReference` entries as imports of the referenced project
 * files; a solution (`.sln`, `.slnx`) imports the projects it holds. The imports make project references edges of the graph.
 */

const SOLUTION_PROJECT = /^Project\("\{[0-9A-Fa-f-]+\}"\)\s*=\s*"[^"]*",\s*"([^"]+)"/;
const PROJECT_FILE = /\.(cs|fs|vb)proj$/i;

const attribute = (element: XmlElement, name: string) =>
  Object.entries(element.attributes).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];

/** A version is an attribute or a child element; with central package management it is in Directory.Packages.props instead. */
function versionOf(reference: XmlElement): string {
  return attribute(reference, 'Version') ?? reference.children.find((c) => c.name === 'Version')?.text ?? '';
}

/** A package with `PrivateAssets="all"` (analyzers, build tools) is not shipped with the project. */
function dependency(reference: XmlElement): DeclaredDependency | undefined {
  const name = attribute(reference, 'Include');
  if (!name) return undefined;
  const privateAssets = attribute(reference, 'PrivateAssets') ?? reference.children.find((c) => c.name === 'PrivateAssets')?.text;
  return { name, version: versionOf(reference), dev: privateAssets?.toLowerCase() === 'all' };
}

function project(content: string): ParsedFile {
  const root = parseXml(content);
  if (root.name !== 'Project') throw new ParseError(`The root element is <${root.name}>, not <Project>`);
  const declares = descendants(root, 'PackageReference').map(dependency).filter((d): d is DeclaredDependency => !!d);
  const imports: RawImport[] = descendants(root, 'ProjectReference').flatMap((r) => {
    const include = attribute(r, 'Include');
    return include ? [{ specifier: include, line: r.line }] : [];
  });
  const sdk = attribute(root, 'Sdk');
  const skeleton = [
    `// .NET project${sdk ? ` (${sdk})` : ''}`,
    ...declares.map((d) => `PackageReference ${d.name} ${d.version}`.trimEnd()),
    ...imports.map((i) => `ProjectReference ${i.specifier}`),
  ].join('\n');
  return { symbols: [], imports, skeleton, ...(declares.length ? { declares } : {}) };
}

function solution(content: string): ParsedFile {
  const imports = content.split('\n').flatMap((text, i) => {
    const match = SOLUTION_PROJECT.exec(text.trim());
    return match && PROJECT_FILE.test(match[1]) ? [{ specifier: match[1], line: i + 1 }] : [];
  });
  if (!/Microsoft Visual Studio Solution File/.test(content)) throw new ParseError('Not a Visual Studio solution file');
  return { symbols: [], imports, skeleton: ['// Solution', ...imports.map((i) => `Project ${i.specifier}`)].join('\n') };
}

function xmlSolution(content: string): ParsedFile {
  const root = parseXml(content);
  if (root.name !== 'Solution') throw new ParseError(`The root element is <${root.name}>, not <Solution>`);
  const imports = descendants(root, 'Project').flatMap((p) => {
    const file = attribute(p, 'Path');
    return file ? [{ specifier: file, line: p.line }] : [];
  });
  return { symbols: [], imports, skeleton: ['// Solution', ...imports.map((i) => `Project ${i.specifier}`)].join('\n') };
}

/** A project path is relative to the manifest's folder and may use backslashes. */
function resolveProject({ from, raw, project: view }: ResolveInput): Resolution {
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), raw.specifier.replace(/\\/g, '/')));
  return !target.startsWith('..') && view.has(target) ? { kind: 'file', target } : { kind: 'unresolved' };
}

export const msbuildPack: LanguagePack = {
  id: 'msbuild',
  data: true,
  claims: (file) => /\.(csproj|props|targets|sln|slnx)$/.test(file),
  parse: async ({ path: file, content }) => {
    if (file.endsWith('.sln')) return solution(content);
    return file.endsWith('.slnx') ? xmlSolution(content) : project(content);
  },
  resolve: resolveProject,
};

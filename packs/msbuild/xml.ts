import { ParseError } from '../../src/packs/pack.js';

/**
 * A small, strict XML reader for MSBuild files (Tree-sitter has no XML grammar in the pinned set). It reads elements,
 * attributes and text; it skips the declaration, comments and processing instructions; and anything not well formed is
 * a ParseError with its line, so the file is recorded with its error (CIN-04).
 */

export interface XmlElement {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  text: string;
  line: number;
}

const NAME = /[A-Za-z_][\w.:-]*/y;
const ATTRIBUTE = /\s+([A-Za-z_][\w.:-]*)\s*=\s*("([^"<]*)"|'([^'<]*)')/y;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (whole, ref: string) => {
    if (ref.startsWith('#x')) return String.fromCodePoint(parseInt(ref.slice(2), 16));
    if (ref.startsWith('#')) return String.fromCodePoint(parseInt(ref.slice(1), 10));
    return ENTITIES[ref] ?? whole;
  });
}

class Reader {
  private at = 0;

  constructor(private readonly text: string) {}

  private line(index = this.at): number {
    return this.text.slice(0, index).split('\n').length;
  }

  fail(message: string, index = this.at): never {
    throw new ParseError(`Invalid XML at line ${this.line(index)}: ${message}`);
  }

  /** Skips whitespace, comments, processing instructions and the XML declaration. */
  skipMisc(): void {
    for (;;) {
      const rest = this.text.slice(this.at);
      const space = /^\s+/.exec(rest);
      if (space) { this.at += space[0].length; continue; }
      const close = rest.startsWith('<!--') ? '-->' : rest.startsWith('<?') ? '?>' : undefined;
      if (!close) return;
      const end = this.text.indexOf(close, this.at);
      if (end < 0) this.fail('unterminated comment or declaration');
      this.at = end + close.length;
    }
  }

  private name(): string {
    NAME.lastIndex = this.at;
    const match = NAME.exec(this.text);
    if (!match) this.fail('expected a name');
    this.at += match[0].length;
    return match[0];
  }

  private attributes(): Record<string, string> {
    const found: Record<string, string> = {};
    for (;;) {
      ATTRIBUTE.lastIndex = this.at;
      const match = ATTRIBUTE.exec(this.text);
      if (!match) return found;
      if (match[1] in found) this.fail(`duplicate attribute ${match[1]}`);
      found[match[1]] = decode(match[3] ?? match[4]);
      this.at += match[0].length;
    }
  }

  /** One element and everything inside it, starting at its `<`. */
  element(): XmlElement {
    const start = this.at;
    if (this.text[this.at] !== '<') this.fail('expected an element');
    this.at++;
    const element: XmlElement = { name: this.name(), attributes: this.attributes(), children: [], text: '', line: this.line(start) };
    const rest = this.text.slice(this.at);
    const end = /^\s*(\/?)>/.exec(rest);
    if (!end) this.fail(`malformed start tag <${element.name}>`);
    this.at += end[0].length;
    if (end[1] === '/') return element;
    this.content(element);
    return element;
  }

  private content(element: XmlElement): void {
    for (;;) {
      const next = this.text.indexOf('<', this.at);
      if (next < 0) this.fail(`<${element.name}> is not closed`, this.text.length);
      element.text += decode(this.text.slice(this.at, next));
      this.at = next;
      if (this.text.startsWith('</', this.at)) {
        this.at += 2;
        const name = this.name();
        if (name !== element.name) this.fail(`</${name}> closes <${element.name}>`);
        if (!/^\s*>/.test(this.text.slice(this.at))) this.fail(`malformed end tag </${name}>`);
        this.at = this.text.indexOf('>', this.at) + 1;
        element.text = element.text.trim();
        return;
      }
      if (this.text.startsWith('<!--', this.at) || this.text.startsWith('<?', this.at)) this.skipMisc();
      else element.children.push(this.element());
    }
  }

  done(): boolean {
    return this.at >= this.text.length;
  }
}

/** The document's root element; text before or after it, or a second root, is an error. */
export function parseXml(text: string): XmlElement {
  const reader = new Reader(text.replace(/^﻿/, ''));
  reader.skipMisc();
  const root = reader.element();
  reader.skipMisc();
  if (!reader.done()) reader.fail('content after the root element');
  return root;
}

/** Every element named `name` below `root`, in document order. */
export function descendants(root: XmlElement, name: string): XmlElement[] {
  return root.children.flatMap((c) => [...(c.name === name ? [c] : []), ...descendants(c, name)]);
}

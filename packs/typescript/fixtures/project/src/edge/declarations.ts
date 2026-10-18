import * as fs from 'node:fs';
export { MAX_ITEMS } from '../orders/types';

function Dec(): ClassDecorator {
  return () => undefined;
}

export interface Repo<T> extends Iterable<T> {
  readonly size: number;
  get(id: string): T | undefined;
}

export default abstract class Store<T> implements Repo<T> {
  @Dec() private readonly items = new Map<string, T>();
  #secret = 1;
  static instances: number;

  constructor(protected readonly name: string, public tag: string, plain: number) {}

  get size(): number {
    return this.items.size;
  }

  set label(value: string) {}

  abstract get(id: string): T | undefined;

  *[Symbol.iterator](): Iterator<T> {
    yield* this.items.values();
  }

  private helper(): void {
    const local = fs.existsSync('x');
    function inner() {}
  }
}

export const VERSION = '1.0', count: number = 2;
let internalState = 0;
export function* ids(): Generator<number> {
  yield internalState++;
}

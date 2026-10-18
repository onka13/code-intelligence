export class Result<T> {
  private constructor(readonly value?: T, readonly error?: string) {}

  static ok<T>(value: T): Result<T> {
    return new Result(value);
  }

  static fail<T>(error: string): Result<T> {
    return new Result<T>(undefined, error);
  }

  get isOk(): boolean {
    return this.error === undefined;
  }
}

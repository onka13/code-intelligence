import { Response } from 'express';

export abstract class BaseController {
  protected readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  protected ok<T>(res: Response, data: T): void {
    res.status(200).json({ success: true, data });
  }

  protected fail(res: Response, status: number, error: string): void {
    res.status(status).json({ success: false, error });
  }
}

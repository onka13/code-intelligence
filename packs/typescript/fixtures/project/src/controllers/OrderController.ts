import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { OrderService } from '../orders/orderService';
import { validateOrder } from '../orders/validation';

export class OrderController extends BaseController {
  private readonly service: OrderService;
  public requestCount = 0;

  constructor(service: OrderService) {
    super('orders');
    this.service = service;
  }

  async show(req: Request, res: Response): Promise<void> {
    this.requestCount++;
    const order = await this.service.find(req.params.id);
    if (!order) return this.fail(res, 404, 'Order not found');
    this.ok(res, order);
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = validateOrder(req.body);
    if (!parsed.ok) return this.fail(res, 400, parsed.error);
    const created = await this.service.place(parsed.value);
    this.ok(res, created);
  }
}

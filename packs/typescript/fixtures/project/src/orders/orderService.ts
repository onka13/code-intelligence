import { randomUUID } from 'node:crypto';
import { IOrderRepository } from './orderRepository';
import { Order, OrderItem, MAX_ITEMS } from './types';
import { OrderEvents } from './orderEvents';
import { Result } from '../shared/result';

export interface IOrderService {
  find(id: string): Promise<Order | undefined>;
  place(items: OrderItem[]): Promise<Result<Order>>;
}

export class OrderService implements IOrderService {
  private readonly events = new OrderEvents();

  constructor(private readonly repository: IOrderRepository) {}

  async find(id: string): Promise<Order | undefined> {
    return this.repository.findById(id);
  }

  async place(items: OrderItem[]): Promise<Result<Order>> {
    if (items.length > MAX_ITEMS) return Result.fail(`At most ${MAX_ITEMS} items`);
    const order: Order = { id: randomUUID(), items, status: 'NEW' };
    const saved = await this.repository.save(order);
    this.events.placed(saved, this);
    return Result.ok(saved);
  }
}

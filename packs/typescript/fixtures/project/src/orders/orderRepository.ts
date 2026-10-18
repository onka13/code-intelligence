import { Order } from './types';

export interface IOrderRepository {
  findById(id: string): Promise<Order | undefined>;
  save(order: Order): Promise<Order>;
}

export class InMemoryOrderRepository implements IOrderRepository {
  private readonly orders = new Map<string, Order>();

  async findById(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async save(order: Order): Promise<Order> {
    this.orders.set(order.id, order);
    return order;
  }
}

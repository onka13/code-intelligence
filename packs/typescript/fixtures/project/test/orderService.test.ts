import { describe, expect, it } from 'vitest';
import { OrderService } from '../src/orders/orderService';
import { InMemoryOrderRepository } from '../src/orders/orderRepository';

describe('OrderService', () => {
  it('places an order', async () => {
    const service = new OrderService(new InMemoryOrderRepository());
    const result = await service.place([{ sku: 'A1', quantity: 1 }]);
    expect(result.isOk).toBe(true);
  });
});

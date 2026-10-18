import type { OrderService } from './orderService';
import { Order } from './types';
import { logger } from '../shared/logger';

export class OrderEvents {
  placed(order: Order, source: OrderService): void {
    logger.info(`order ${order.id} placed by ${source.constructor.name}`);
  }
}

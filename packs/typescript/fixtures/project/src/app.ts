import express, { Express } from 'express';
import { orderRoutes } from './routes/orderRoutes';
import { InMemoryOrderRepository } from './orders/orderRepository';
import { OrderService } from './orders/orderService';

/** Wires the repository, the service and the routes. */
export function createApp(): Express {
  const app = express();
  app.use(express.json());
  const service = new OrderService(new InMemoryOrderRepository());
  app.use('/orders', orderRoutes(service));
  return app;
}

import { Router } from 'express';
import { OrderController } from '../controllers/OrderController';
import { OrderService } from '../orders/orderService';

export const orderRoutes = (service: OrderService): Router => {
  const router = Router();
  const controller = new OrderController(service);
  router.get('/:id', (req, res) => controller.show(req, res));
  router.post('/', (req, res) => controller.create(req, res));
  return router;
};

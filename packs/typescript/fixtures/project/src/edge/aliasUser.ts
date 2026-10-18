import { logger } from '@shared/logger';
import type { Order } from '../orders/types.js';

export const describe = (order: Order): string => `${order.id}`;
logger.info('loaded');

import { z } from 'zod';
import { OrderItem } from './types';

export const orderSchema = z.array(z.object({ sku: z.string(), quantity: z.number().int().positive() }));

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateOrder(body: unknown): Validation<OrderItem[]> {
  const parsed = orderSchema.safeParse(body);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: parsed.error.message };
}

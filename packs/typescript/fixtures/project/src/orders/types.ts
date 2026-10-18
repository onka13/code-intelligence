export type OrderStatus = 'NEW' | 'PAID' | 'SHIPPED';

export enum PaymentMethod {
  Card = 'CARD',
  Transfer = 'TRANSFER',
}

export interface OrderItem {
  sku: string;
  quantity: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  status: OrderStatus;
  payment?: PaymentMethod;
}

export const MAX_ITEMS = 50;

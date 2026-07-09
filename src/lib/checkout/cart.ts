import { z } from 'zod';
import db from '@/lib/db/client';
import type { PriceLineItem } from './pricing';

export const cartItemsSchema = z
  .array(z.object({ productId: z.string(), quantity: z.number().int().positive() }))
  .min(1, 'Your cart is empty');

export type CartItemInput = z.infer<typeof cartItemsSchema>[number];

/**
 * Resolve client cart lines to authoritative line items using DB prices.
 * Unknown products are dropped. This is the ONLY source of prices used for
 * pricing — the client never dictates price.
 */
export function resolveLineItems(cart: CartItemInput[]): PriceLineItem[] {
  const stmt = db.prepare('SELECT id, name, price FROM products WHERE id = ?');
  const items: PriceLineItem[] = [];
  for (const line of cart) {
    const p = stmt.get(line.productId) as { id: string; name: string; price: number } | undefined;
    if (p) items.push({ productId: p.id, name: p.name, price: p.price, quantity: line.quantity });
  }
  return items;
}

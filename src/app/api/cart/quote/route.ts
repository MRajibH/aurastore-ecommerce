import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cartItemsSchema, resolveLineItems } from '@/lib/checkout/cart';
import { computePricing } from '@/lib/checkout/pricing';
import { validateDiscount } from '@/lib/discounts';

const quoteSchema = z.object({
  cartItems: cartItemsSchema,
  discountCode: z.string().trim().optional(),
  shippingMethod: z.string().optional(),
});

/**
 * Server-authoritative price quote for the cart/checkout UI. Recomputes the
 * full breakdown from DB prices and validates any discount code. Never trusts
 * client-supplied prices or totals.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = quoteSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { cartItems, discountCode, shippingMethod } = result.data;
    const items = resolveLineItems(cartItems);
    if (items.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty' }, { status: 400 });
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

    let discount = null;
    let discountMessage: string | null = null;
    let discountApplied = false;
    if (discountCode) {
      const validation = validateDiscount(discountCode, subtotal);
      if (validation.ok) {
        discount = validation.discount;
        discountApplied = true;
      } else {
        discountMessage = validation.reason;
      }
    }

    const breakdown = computePricing({ items, discount, shippingMethodId: shippingMethod ?? 'standard' });

    return NextResponse.json({
      breakdown,
      discount: { applied: discountApplied, code: discountCode ?? null, message: discountMessage },
    });
  } catch (error) {
    console.error('Cart quote error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

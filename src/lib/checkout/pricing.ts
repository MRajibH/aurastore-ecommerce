import { FREE_SHIPPING_THRESHOLD, TAX_RATE, getShippingMethod } from './config';
import type { Discount } from '@/lib/discounts/types';

export interface PriceLineItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface PriceBreakdown {
  subtotal: number;
  discount: number;
  discountCode: string | null;
  shipping: number;
  shippingMethod: string;
  freeShipping: boolean;
  tax: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Discount value for a subtotal (0 if it doesn't qualify). Never exceeds subtotal. */
export function computeDiscountAmount(subtotal: number, discount: Discount | null): number {
  if (!discount || subtotal < discount.minSubtotal) return 0;
  const raw = discount.type === 'percent' ? subtotal * (discount.value / 100) : discount.value;
  return round2(Math.min(raw, subtotal));
}

/**
 * Compute a full, server-authoritative price breakdown. This is the single
 * source of truth used by both the cart quote endpoint and the final checkout —
 * prices come from the caller (which reads them from the DB), never the client.
 */
export function computePricing(params: {
  items: PriceLineItem[];
  discount: Discount | null;
  shippingMethodId: string;
}): PriceBreakdown {
  const subtotal = round2(params.items.reduce((sum, i) => sum + i.price * i.quantity, 0));
  const discount = computeDiscountAmount(subtotal, params.discount);
  const discountedSubtotal = round2(subtotal - discount);

  const method = getShippingMethod(params.shippingMethodId);
  const freeShipping = discountedSubtotal >= FREE_SHIPPING_THRESHOLD;
  const shipping = freeShipping ? 0 : method.amount;

  const tax = round2(discountedSubtotal * TAX_RATE);
  const total = round2(discountedSubtotal + shipping + tax);

  return {
    subtotal,
    discount,
    discountCode: discount > 0 && params.discount ? params.discount.code : null,
    shipping,
    shippingMethod: method.id,
    freeShipping,
    tax,
    total,
  };
}

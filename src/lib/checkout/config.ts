// Storefront commerce configuration. Kept as plain constants so both the server
// (pricing engine, checkout API) and the client (cart drawer, checkout UI) can
// share one source of truth. In a multi-tenant SaaS these would come from a
// per-store settings table — the shape stays the same.

/** Order subtotal (after discounts) at/above which shipping is free. */
export const FREE_SHIPPING_THRESHOLD = 50;

/** Flat sales-tax rate applied to the discounted subtotal (0 = no tax shown). */
export const TAX_RATE = 0;

export interface ShippingMethod {
  id: string;
  label: string;
  amount: number;
  eta: string;
}

export const SHIPPING_METHODS: ShippingMethod[] = [
  { id: 'standard', label: 'Standard Shipping', amount: 5.99, eta: '3–5 business days' },
  { id: 'express', label: 'Express Shipping', amount: 14.99, eta: '1–2 business days' },
];

export const DEFAULT_SHIPPING_METHOD = SHIPPING_METHODS[0].id;

export function getShippingMethod(id: string | undefined): ShippingMethod {
  return SHIPPING_METHODS.find((m) => m.id === id) ?? SHIPPING_METHODS[0];
}

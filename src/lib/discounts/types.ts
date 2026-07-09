import { z } from 'zod';

export type DiscountType = 'percent' | 'fixed';

export interface Discount {
  id: string;
  code: string;
  type: DiscountType;
  value: number;          // percent (0–100) or fixed USD amount
  minSubtotal: number;    // minimum order subtotal to qualify
  active: boolean;
  startsAt: number | null;
  endsAt: number | null;
  usageLimit: number | null;
  usedCount: number;
  createdAt: number;
}

export const createDiscountSchema = z.object({
  code: z.string().trim().min(2, 'Code must be at least 2 characters').max(40),
  type: z.enum(['percent', 'fixed']),
  value: z.number().positive('Value must be positive'),
  minSubtotal: z.number().nonnegative().default(0),
  usageLimit: z.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
}).refine((d) => d.type !== 'percent' || d.value <= 100, {
  message: 'Percent discount cannot exceed 100',
  path: ['value'],
});
export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;

/** Result of validating a code against a given subtotal. */
export type DiscountValidation =
  | { ok: true; discount: Discount }
  | { ok: false; reason: string };

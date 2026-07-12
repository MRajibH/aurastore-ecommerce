import type { PaymentMethod } from '@/lib/pos/types';

/** Human labels for payment methods (shared by the register + receipt). */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  other: 'Other',
};

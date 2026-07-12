/** How an in-store POS sale was paid. */
export type PaymentMethod = 'cash' | 'card' | 'other';

/** A line requested by the register (client sends only id + quantity). */
export interface PosCartItem {
  productId: string;
  quantity: number;
}

/** Input to createPosSale — never carries prices/totals (server is authoritative). */
export interface PosSaleInput {
  items: PosCartItem[];
  discountCode?: string | null;
  paymentMethod: PaymentMethod;
  /** Cash handed over by the customer (cash payments only). */
  amountTendered?: number | null;
  /** Optional walk-in customer details (for the receipt). */
  customerName?: string | null;
  customerEmail?: string | null;
}

export interface PosSaleLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

/** Full, server-computed result of a completed sale — also the receipt payload. */
export interface PosSaleResult {
  orderId: string;
  lines: PosSaleLine[];
  subtotal: number;
  discount: number;
  discountCode: string | null;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: number | null;
  changeDue: number | null;
  customerName: string | null;
  customerEmail: string | null;
  createdAt: number;
}

/** A product as shown in the register's search/scan results. */
export interface PosProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url: string;
  category: string;
}

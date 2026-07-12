import db from '@/lib/db/client';
import crypto from 'crypto';
import { computeDiscountAmount } from '@/lib/checkout/pricing';
import { TAX_RATE } from '@/lib/checkout/config';
import { validateDiscount, incrementDiscountUsage } from '@/lib/discounts';
import type { PosProduct, PosSaleInput, PosSaleLine, PosSaleResult } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

const SHIPPING_ADDRESS = 'In-store purchase (POS)';

/**
 * Fast product lookup for the register: an exact SKU/ID match (barcode scan)
 * first, then a name/category contains-search. Returns lightweight rows.
 */
export function lookupProducts(query: string, limit = 24): PosProduct[] {
  const q = query.trim();
  if (!q) {
    return db
      .prepare('SELECT id, name, price, stock, image_url, category FROM products ORDER BY created_at DESC LIMIT ?')
      .all(limit) as PosProduct[];
  }
  const like = `%${q}%`;
  return db
    .prepare(
      `SELECT id, name, price, stock, image_url, category FROM products
       WHERE id = ? OR name LIKE ? OR category LIKE ?
       ORDER BY CASE WHEN id = ? THEN 0 WHEN name LIKE ? THEN 1 ELSE 2 END, name ASC
       LIMIT ?`,
    )
    .all(q, like, like, q, like, limit) as PosProduct[];
}

/** Resolve a single product by exact id (used for scan-to-add). */
export function getPosProduct(id: string): PosProduct | undefined {
  return db
    .prepare('SELECT id, name, price, stock, image_url, category FROM products WHERE id = ?')
    .get(id) as PosProduct | undefined;
}

/**
 * Record an in-store sale: validate the cart against live DB prices/stock,
 * compute a server-authoritative total (no shipping; POS is in-store), decrement
 * stock, and persist the order (channel='pos') + items in one transaction.
 * Throws with a user-facing message on stock/discount/payment problems.
 */
export function createPosSale(input: PosSaleInput, cashierUserId: string): PosSaleResult {
  if (!input.items || input.items.length === 0) {
    throw new Error('Cannot complete a sale with an empty cart.');
  }

  let result: PosSaleResult | null = null;

  const txn = db.transaction(() => {
    // 1. Resolve products (authoritative price + stock) and decrement stock.
    const lines: PosSaleLine[] = [];
    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new Error('Each line must have a quantity of at least 1.');
      }
      const product = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ?').get(item.productId) as
        | { id: string; name: string; price: number; stock: number }
        | undefined;
      if (!product) throw new Error('A scanned product is no longer available.');
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Only ${product.stock} left.`);
      }
      lines.push({ productId: product.id, name: product.name, price: product.price, quantity: item.quantity });
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, product.id);
    }

    // 2. Pricing (no shipping for in-store). Discount validated against subtotal.
    const subtotal = round2(lines.reduce((s, l) => s + l.price * l.quantity, 0));
    let discountObj = null;
    if (input.discountCode) {
      const validation = validateDiscount(input.discountCode, subtotal);
      if (!validation.ok) throw new Error(validation.reason);
      discountObj = validation.discount;
    }
    const discount = computeDiscountAmount(subtotal, discountObj);
    const discountedSubtotal = round2(subtotal - discount);
    const tax = round2(discountedSubtotal * TAX_RATE);
    const total = round2(discountedSubtotal + tax);

    // 3. Payment: cash requires tendered >= total; compute change.
    let amountTendered: number | null = null;
    let changeDue: number | null = null;
    if (input.paymentMethod === 'cash') {
      amountTendered = round2(input.amountTendered ?? 0);
      if (amountTendered < total) {
        throw new Error(`Cash tendered ($${amountTendered.toFixed(2)}) is less than the total ($${total.toFixed(2)}).`);
      }
      changeDue = round2(amountTendered - total);
    }

    // 4. Persist the order (walk-in → user_id null; customer details are optional).
    const orderId = crypto.randomUUID();
    const createdAt = Date.now();
    const customerName = input.customerName?.trim() || null;
    const customerEmail = input.customerEmail?.trim() || null;
    db.prepare(
      `INSERT INTO orders (
        id, user_id, guest_email, guest_name, subtotal, discount_code, discount_amount,
        shipping_amount, tax_amount, total_amount, status, shipping_address, notes, created_at,
        channel, payment_method, amount_tendered, change_due
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'paid', ?, ?, ?, 'pos', ?, ?, ?)`,
    ).run(
      orderId,
      cashierUserId,
      customerEmail,
      customerName,
      subtotal,
      discount > 0 && discountObj ? discountObj.code : null,
      discount,
      tax,
      total,
      SHIPPING_ADDRESS,
      null,
      createdAt,
      input.paymentMethod,
      amountTendered,
      changeDue,
    );

    const insertItem = db.prepare(
      'INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)',
    );
    for (const l of lines) {
      insertItem.run(crypto.randomUUID(), orderId, l.productId, l.quantity, l.price);
    }

    // 5. Record discount usage.
    if (discount > 0 && discountObj) incrementDiscountUsage(discountObj.id);

    result = {
      orderId,
      lines,
      subtotal,
      discount,
      discountCode: discount > 0 && discountObj ? discountObj.code : null,
      tax,
      total,
      paymentMethod: input.paymentMethod,
      amountTendered,
      changeDue,
      customerName,
      customerEmail,
      createdAt,
    };
  });

  txn();
  if (!result) throw new Error('Sale could not be completed.');
  return result;
}

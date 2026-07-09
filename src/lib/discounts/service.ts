import crypto from 'crypto';
import db from '@/lib/db/client';
import type { CreateDiscountInput, Discount, DiscountType, DiscountValidation } from './types';

interface DiscountRow {
  id: string;
  code: string;
  type: string;
  value: number;
  min_subtotal: number;
  active: number;
  starts_at: number | null;
  ends_at: number | null;
  usage_limit: number | null;
  used_count: number;
  created_at: number;
}

function mapRow(row: DiscountRow): Discount {
  return {
    id: row.id,
    code: row.code,
    type: row.type as DiscountType,
    value: row.value,
    minSubtotal: row.min_subtotal,
    active: row.active === 1,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    usageLimit: row.usage_limit,
    usedCount: row.used_count,
    createdAt: row.created_at,
  };
}

/** Case-insensitive lookup by code. */
export function getDiscountByCode(code: string): Discount | null {
  const row = db
    .prepare('SELECT * FROM discounts WHERE code = ? COLLATE NOCASE')
    .get(code.trim()) as DiscountRow | undefined;
  return row ? mapRow(row) : null;
}

/**
 * Validate a code for a given subtotal. Pure w.r.t. the current time via `now`
 * so it is deterministic and testable. Checks active, date window, usage limit,
 * and minimum-subtotal requirement.
 */
export function validateDiscount(code: string, subtotal: number, now = Date.now()): DiscountValidation {
  const discount = getDiscountByCode(code);
  if (!discount) return { ok: false, reason: 'That code is not valid.' };
  if (!discount.active) return { ok: false, reason: 'That code is no longer active.' };
  if (discount.startsAt && now < discount.startsAt) return { ok: false, reason: 'That code is not active yet.' };
  if (discount.endsAt && now > discount.endsAt) return { ok: false, reason: 'That code has expired.' };
  if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
    return { ok: false, reason: 'That code has reached its usage limit.' };
  }
  if (subtotal < discount.minSubtotal) {
    return { ok: false, reason: `Add $${(discount.minSubtotal - subtotal).toFixed(2)} more to use this code.` };
  }
  return { ok: true, discount };
}

export function incrementDiscountUsage(id: string): void {
  db.prepare('UPDATE discounts SET used_count = used_count + 1 WHERE id = ?').run(id);
}

// ---- Admin ----

export function listDiscounts(): Discount[] {
  const rows = db.prepare('SELECT * FROM discounts ORDER BY created_at DESC').all() as DiscountRow[];
  return rows.map(mapRow);
}

export function createDiscount(input: CreateDiscountInput): { ok: true; id: string } | { ok: false; reason: string } {
  if (getDiscountByCode(input.code)) {
    return { ok: false, reason: 'A discount with that code already exists.' };
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO discounts (id, code, type, value, min_subtotal, active, starts_at, ends_at, usage_limit, used_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 0, ?)`,
  ).run(
    id,
    input.code.trim().toUpperCase(),
    input.type,
    input.value,
    input.minSubtotal,
    input.active ? 1 : 0,
    input.usageLimit ?? null,
    Date.now(),
  );
  return { ok: true, id };
}

export function setDiscountActive(id: string, active: boolean): boolean {
  return db.prepare('UPDATE discounts SET active = ? WHERE id = ?').run(active ? 1 : 0, id).changes > 0;
}

export function deleteDiscount(id: string): boolean {
  return db.prepare('DELETE FROM discounts WHERE id = ?').run(id).changes > 0;
}

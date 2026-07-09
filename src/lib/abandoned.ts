import crypto from 'crypto';
import db from '@/lib/db/client';

export interface AbandonedCartItem {
  name: string;
  quantity: number;
  price: number;
}

export interface AbandonedCart {
  id: string;
  email: string;
  name: string | null;
  items: AbandonedCartItem[];
  subtotal: number;
  recovered: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Row {
  id: string;
  email: string;
  name: string | null;
  items_json: string;
  subtotal: number;
  recovered: number;
  created_at: number;
  updated_at: number;
}

function mapRow(r: Row): AbandonedCart {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    items: JSON.parse(r.items_json) as AbandonedCartItem[],
    subtotal: r.subtotal,
    recovered: r.recovered === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Upsert (by email) an in-progress cart so it can be recovered if abandoned. */
export function upsertAbandonedCart(params: {
  email: string;
  name: string | null;
  items: AbandonedCartItem[];
  subtotal: number;
}): void {
  const email = params.email.trim().toLowerCase();
  const itemsJson = JSON.stringify(params.items);
  const now = Date.now();
  const existing = db.prepare('SELECT id FROM abandoned_carts WHERE email = ?').get(email) as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE abandoned_carts SET name = ?, items_json = ?, subtotal = ?, recovered = 0, updated_at = ? WHERE id = ?')
      .run(params.name, itemsJson, params.subtotal, now, existing.id);
  } else {
    db.prepare('INSERT INTO abandoned_carts (id, email, name, items_json, subtotal, recovered, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
      .run(crypto.randomUUID(), email, params.name, itemsJson, params.subtotal, now, now);
  }
}

/** Mark any abandoned cart for this email as recovered (call after a successful order). */
export function markRecoveredByEmail(email: string | null | undefined): void {
  if (!email) return;
  db.prepare('UPDATE abandoned_carts SET recovered = 1, updated_at = ? WHERE email = ?').run(Date.now(), email.trim().toLowerCase());
}

export function getAbandonedCart(id: string): AbandonedCart | null {
  const row = db.prepare('SELECT * FROM abandoned_carts WHERE id = ?').get(id) as Row | undefined;
  return row ? mapRow(row) : null;
}

export function listAbandonedCarts(): AbandonedCart[] {
  const rows = db.prepare('SELECT * FROM abandoned_carts ORDER BY updated_at DESC').all() as Row[];
  return rows.map(mapRow);
}

import crypto from 'crypto';
import db from '@/lib/db/client';
import { getEmailProvider } from './provider';
import type { EmailMessage } from './types';

/**
 * Persist an email to the outbox and attempt delivery via the configured
 * provider. The outbox row is the durable record (status queued→sent/failed),
 * so a real deployment could retry failed rows from a cron. Safe to call
 * fire-and-forget from request handlers.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO emails (id, to_email, subject, type, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, message.to, message.subject, message.type, message.html, 'queued', Date.now());

  try {
    const result = await getEmailProvider().send(message);
    if (result.ok) {
      db.prepare('UPDATE emails SET status = ?, sent_at = ? WHERE id = ?').run('sent', Date.now(), id);
    } else {
      db.prepare('UPDATE emails SET status = ?, error = ? WHERE id = ?').run('failed', result.error ?? 'unknown', id);
    }
  } catch (err) {
    db.prepare('UPDATE emails SET status = ?, error = ? WHERE id = ?').run(
      'failed',
      err instanceof Error ? err.message : 'unknown',
      id,
    );
  }
}

// ---- Newsletter subscribers ----

export function subscribeEmail(email: string, source: string): { created: boolean } {
  const normalized = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM email_subscribers WHERE email = ?').get(normalized) as
    | { id: string }
    | undefined;
  if (existing) {
    db.prepare("UPDATE email_subscribers SET status = 'subscribed' WHERE id = ?").run(existing.id);
    return { created: false };
  }
  db.prepare('INSERT INTO email_subscribers (id, email, status, source, created_at) VALUES (?, ?, ?, ?, ?)').run(
    crypto.randomUUID(),
    normalized,
    'subscribed',
    source,
    Date.now(),
  );
  return { created: true };
}

export function subscriberCount(): number {
  return (db.prepare("SELECT COUNT(*) as c FROM email_subscribers WHERE status = 'subscribed'").get() as { c: number }).c;
}

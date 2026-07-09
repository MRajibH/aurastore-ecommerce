import type { EmailMessage, EmailProvider, EmailSendResult } from './types';

/**
 * Default provider: no external service configured. Emails are still persisted
 * to the `emails` outbox (by the service) and logged, so the full lifecycle is
 * exercisable in dev/CI. Swap for a real provider by setting env vars.
 */
class LogProvider implements EmailProvider {
  readonly name = 'log';
  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.log(`[email:log] to=${message.to} type=${message.type} subject="${message.subject}"`);
    return { ok: true };
  }
}

/** Resend (https://resend.com) HTTP provider — no SDK dependency required. */
class ResendProvider implements EmailProvider {
  readonly name = 'resend';
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `Resend responded ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'request failed' };
    }
  }
}

let cached: EmailProvider | null = null;

/** Resolve the configured provider (memoized). RESEND_API_KEY → Resend, else Log. */
export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'AURA Store <onboarding@resend.dev>';
  cached = apiKey ? new ResendProvider(apiKey, from) : new LogProvider();
  return cached;
}

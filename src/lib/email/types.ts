export type EmailType =
  | 'welcome'
  | 'newsletter_welcome'
  | 'order_confirmation'
  | 'abandoned_cart';

export interface EmailMessage {
  to: string;
  subject: string;
  type: EmailType;
  html: string;
  text: string;
}

export interface EmailSendResult {
  ok: boolean;
  error?: string;
}

/** Transport abstraction — swap the implementation without touching callers. */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

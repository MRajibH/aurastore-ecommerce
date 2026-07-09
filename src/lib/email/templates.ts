import { SITE_NAME, SITE_URL } from '@/lib/site';
import type { EmailMessage } from './types';

// Minimal, email-client-safe HTML (inline styles, table-free simple layout).
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#0a0a0f">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="text-align:center;padding:16px 0">
      <span style="font-size:22px;font-weight:800;color:#4f46e5;letter-spacing:1px">AURA</span>
      <span style="font-size:22px;font-weight:300;color:#3f3f46;letter-spacing:2px"> STORE</span>
    </div>
    <div style="background:#fff;border-radius:14px;padding:28px;border:1px solid #e5e7eb">
      <h1 style="font-size:20px;margin:0 0 14px">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#8b8b95;font-size:12px;margin-top:18px">
      © ${new Date().getFullYear()} ${SITE_NAME} · <a href="${SITE_URL}" style="color:#4f46e5">${SITE_URL.replace(/^https?:\/\//, '')}</a>
    </p>
  </div></body></html>`;
}

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${label}</a>`;

export function welcomeEmail(name: string, to: string): EmailMessage {
  const first = name.split(' ')[0] || 'there';
  const html = layout(`Welcome, ${first}! 👋`, `
    <p style="line-height:1.6;color:#3f3f46">Thanks for creating an account at ${SITE_NAME}. Explore curated premium electronics and smart-living essentials — with free shipping over $50.</p>
    <p style="margin:22px 0">${btn(`${SITE_URL}/#products`, 'Start shopping')}</p>`);
  return { to, subject: `Welcome to ${SITE_NAME}`, type: 'welcome', html, text: `Welcome to ${SITE_NAME}, ${first}! Start shopping at ${SITE_URL}` };
}

export function newsletterWelcomeEmail(to: string): EmailMessage {
  const html = layout('Thanks for subscribing! 🎉', `
    <p style="line-height:1.6;color:#3f3f46">You're on the list. Here's <strong>10% off</strong> your first order:</p>
    <p style="font-size:22px;font-weight:800;letter-spacing:2px;color:#4f46e5;margin:14px 0">WELCOME10</p>
    <p style="margin:22px 0">${btn(`${SITE_URL}/#products`, 'Shop now')}</p>`);
  return { to, subject: `Your 10% welcome offer`, type: 'newsletter_welcome', html, text: `Thanks for subscribing! Use code WELCOME10 for 10% off. ${SITE_URL}` };
}

export interface OrderEmailItem { name: string; quantity: number; price: number; }
export function orderConfirmationEmail(params: {
  to: string;
  orderId: string;
  items: OrderEmailItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: string;
}): EmailMessage {
  const rows = params.items
    .map((i) => `<tr><td style="padding:6px 0;color:#3f3f46">${i.name} × ${i.quantity}</td><td style="padding:6px 0;text-align:right;color:#0a0a0f">$${(i.price * i.quantity).toFixed(2)}</td></tr>`)
    .join('');
  const line = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:3px 0;color:${strong ? '#0a0a0f' : '#8b8b95'};font-weight:${strong ? 700 : 400}">${label}</td><td style="padding:3px 0;text-align:right;font-weight:${strong ? 700 : 400}">${value}</td></tr>`;
  const html = layout('Order confirmed ✅', `
    <p style="line-height:1.6;color:#3f3f46">Thanks for your order! Here's your receipt.</p>
    <p style="color:#8b8b95;font-size:13px">Order ID: <code>${params.orderId}</code></p>
    <table style="width:100%;border-collapse:collapse;margin:14px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb">${rows}</table>
    <table style="width:100%;border-collapse:collapse">
      ${line('Subtotal', `$${params.subtotal.toFixed(2)}`)}
      ${params.discount > 0 ? line('Discount', `−$${params.discount.toFixed(2)}`) : ''}
      ${line('Shipping', params.shipping === 0 ? 'FREE' : `$${params.shipping.toFixed(2)}`)}
      ${params.tax > 0 ? line('Tax', `$${params.tax.toFixed(2)}`) : ''}
      ${line('Total', `$${params.total.toFixed(2)}`, true)}
    </table>
    <p style="color:#8b8b95;font-size:13px;margin-top:16px">Shipping to: ${params.shippingAddress}</p>`);
  const text = `Order ${params.orderId} confirmed. Total $${params.total.toFixed(2)}. Thank you!`;
  return { to: params.to, subject: `Your ${SITE_NAME} order is confirmed`, type: 'order_confirmation', html, text };
}

export function abandonedCartEmail(params: { to: string; name: string | null; items: OrderEmailItem[] }): EmailMessage {
  const first = params.name?.split(' ')[0] || 'there';
  const list = params.items.map((i) => `<li style="color:#3f3f46">${i.name} × ${i.quantity}</li>`).join('');
  const html = layout('You left something behind 🛒', `
    <p style="line-height:1.6;color:#3f3f46">Hi ${first}, your cart is waiting for you:</p>
    <ul style="line-height:1.8">${list}</ul>
    <p style="margin:22px 0">${btn(`${SITE_URL}/checkout`, 'Complete your order')}</p>`);
  return { to: params.to, subject: `Your cart is waiting`, type: 'abandoned_cart', html, text: `Your ${SITE_NAME} cart is waiting: ${SITE_URL}/checkout` };
}

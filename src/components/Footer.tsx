import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';
import NewsletterForm from './NewsletterForm';
import styles from './Footer.module.css';

const SHOP_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/#products', label: 'All Products' },
];

const COMPANY_LINKS = [
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
];

const LEGAL_LINKS = [
  { href: '/shipping-returns', label: 'Shipping & Returns' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/cookies', label: 'Cookie Policy' },
  { href: '/terms', label: 'Terms of Service' },
];

const PAYMENTS = ['Visa', 'Mastercard', 'Amex', 'Apple Pay', 'PayPal'];

const SOCIALS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: 'Instagram',
    href: 'https://instagram.com',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://facebook.com',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 9h3l.4-3H14V4.3c0-.9.3-1.5 1.6-1.5H17V.1C16.7.1 15.7 0 14.6 0 12.2 0 10.6 1.4 10.6 4v2H8v3h2.6v9H14V9z" /></svg>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M23 7.5a3 3 0 0 0-2.1-2.1C19 4.9 12 4.9 12 4.9s-7 0-8.9.5A3 3 0 0 0 1 7.5C.5 9.4.5 12 .5 12s0 2.6.5 4.5A3 3 0 0 0 3.1 18.6c1.9.5 8.9.5 8.9.5s7 0 8.9-.5A3 3 0 0 0 23 16.5c.5-1.9.5-4.5.5-4.5s0-2.6-.5-4.5zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z" /></svg>
    ),
  },
  {
    label: 'TikTok',
    href: 'https://tiktok.com',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.5 0h-3v15.3a3 3 0 1 1-2.4-2.9V9.3a6 6 0 1 0 5.4 6V7.7a7.6 7.6 0 0 0 4.5 1.5V6.2a4.7 4.7 0 0 1-4.5-4.7V0z" /></svg>
    ),
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`${styles.grid} container`}>
        <div className={styles.brandCol}>
          <div className={styles.logo}>
            <span className={styles.logoGlow}>AURA</span>
            <span className={styles.logoSub}>STORE</span>
          </div>
          <p className={styles.tagline}>
            Curated premium electronics & smart-living essentials. Fast free shipping over $50.
          </p>
          <div className={styles.socials}>
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className={styles.socialLink}
                aria-label={s.label}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        <nav className={styles.col} aria-label="Shop">
          <h3 className={styles.colTitle}>Shop</h3>
          {SHOP_LINKS.map((l) => (
            <Link key={l.label} href={l.href} className={styles.link}>{l.label}</Link>
          ))}
          {COMPANY_LINKS.map((l) => (
            <Link key={l.label} href={l.href} className={styles.link}>{l.label}</Link>
          ))}
        </nav>

        <nav className={styles.col} aria-label="Legal">
          <h3 className={styles.colTitle}>Help & Legal</h3>
          {LEGAL_LINKS.map((l) => (
            <Link key={l.label} href={l.href} className={styles.link}>{l.label}</Link>
          ))}
        </nav>

        <NewsletterForm />
      </div>

      <div className={styles.bottomBar}>
        <div className={`${styles.bottomInner} container`}>
          <p className={styles.copy}>© {year} {SITE_NAME}. All rights reserved.</p>
          <div className={styles.payments} aria-label="Accepted payment methods">
            {PAYMENTS.map((p) => (
              <span key={p} className={styles.payMark}>{p}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

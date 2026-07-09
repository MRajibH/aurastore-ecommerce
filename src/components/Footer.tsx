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
        <div className="container">
          <p className={styles.copy}>© {year} {SITE_NAME}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

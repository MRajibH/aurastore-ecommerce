import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import ContactForm from './ContactForm';
import styles from './contact.module.css';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: `Get in touch with the ${SITE_NAME} team — we typically reply within one business day.`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <div className={`${styles.wrap} container section-padding`}>
      <div className={styles.intro}>
        <h1 className={`${styles.title} gradient-text`}>Contact Us</h1>
        <p className={styles.lead}>
          Questions about an order, a product, or a return? Send us a message and we&apos;ll reply
          within one business day.
        </p>
        <ul className={styles.channels}>
          <li><strong>Support:</strong> support@aurastore.example</li>
          <li><strong>Hours:</strong> Mon–Fri, 9am–6pm</li>
        </ul>
      </div>
      <ContactForm />
    </div>
  );
}

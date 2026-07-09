import { SITE_NAME } from '@/lib/site';

/**
 * Structured content for legal / policy pages. Kept as data (not JSX) so pages
 * are trivial to add, edit, translate, or later drive from a CMS. Each page
 * route renders one of these via the shared <LegalPage /> component.
 *
 * NOTE: This is professional boilerplate — have it reviewed by counsel before
 * relying on it in a specific jurisdiction.
 */
export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  description: string;
  updated: string; // ISO date
  intro: string;
  sections: LegalSection[];
}

const CONTACT_EMAIL = 'support@aurastore.example';

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    description: `How ${SITE_NAME} collects, uses, and protects your personal data.`,
    updated: '2026-07-01',
    intro: `${SITE_NAME} respects your privacy. This policy explains what we collect, why, and the choices you have.`,
    sections: [
      { heading: 'Information we collect', body: [
        'Account data you provide (name, email, password — always stored hashed).',
        'Order and shipping details needed to fulfil purchases.',
        'Usage and device data collected via cookies and similar technologies, subject to your consent.',
      ]},
      { heading: 'How we use your data', body: [
        'To process orders, provide support, and operate your account.',
        'To improve the store and, where you have consented, to measure and personalize advertising (e.g. the Meta Pixel and Conversions API).',
      ]},
      { heading: 'Your choices', body: [
        'You can accept or decline non-essential cookies at any time via the cookie banner.',
        `You may request access, correction, or deletion of your data by contacting ${CONTACT_EMAIL}.`,
      ]},
      { heading: 'Data sharing', body: [
        'We share data only with processors needed to run the store (payments, shipping, analytics/advertising) and only as permitted by law.',
      ]},
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    description: `The terms governing your use of ${SITE_NAME}.`,
    updated: '2026-07-01',
    intro: `By using ${SITE_NAME} you agree to these terms. Please read them carefully.`,
    sections: [
      { heading: 'Use of the store', body: [
        'You agree to provide accurate information and to use the store lawfully.',
        'You are responsible for keeping your account credentials secure.',
      ]},
      { heading: 'Orders & pricing', body: [
        'All prices are shown in USD. We may correct pricing or availability errors and cancel affected orders with a full refund.',
      ]},
      { heading: 'Limitation of liability', body: [
        `${SITE_NAME} is provided "as is" to the fullest extent permitted by law.`,
      ]},
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    description: `How ${SITE_NAME} uses cookies and how to manage them.`,
    updated: '2026-07-01',
    intro: 'We use a small number of essential cookies plus optional analytics/advertising cookies you control.',
    sections: [
      { heading: 'Essential cookies', body: [
        'Required for core functionality such as your session, cart, and cookie-consent choice. These cannot be disabled.',
      ]},
      { heading: 'Analytics & advertising cookies', body: [
        'Used for measurement and personalized advertising (e.g. Meta Pixel). These load only after you accept them in the cookie banner.',
      ]},
      { heading: 'Managing cookies', body: [
        'Use the cookie banner to accept or decline. You can also clear cookies in your browser settings to reset your choice.',
      ]},
    ],
  },
  'shipping-returns': {
    slug: 'shipping-returns',
    title: 'Shipping & Returns',
    description: `Delivery timelines, costs, and the return policy for ${SITE_NAME}.`,
    updated: '2026-07-01',
    intro: 'Fast, tracked shipping and a hassle-free 30-day return window.',
    sections: [
      { heading: 'Shipping', body: [
        'Free standard shipping on orders over $50. Standard delivery is typically 3–5 business days.',
        'You will receive tracking details by email once your order ships.',
      ]},
      { heading: 'Returns & refunds', body: [
        'Return most items within 30 days of delivery for a full refund, provided they are in original condition.',
        'Refunds are issued to the original payment method once the return is received and inspected.',
      ]},
      { heading: 'Warranty', body: [
        'Eligible products are covered by a 2-year manufacturer warranty against defects.',
      ]},
    ],
  },
};

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS[slug];
}

/** Next.js Metadata for a policy page (used by each static legal route). */
export function legalMetadata(slug: string) {
  const doc = LEGAL_DOCS[slug];
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `/${doc.slug}` },
    openGraph: { title: doc.title, description: doc.description, url: `/${doc.slug}` },
  };
}

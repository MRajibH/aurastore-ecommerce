import type { LegalDoc } from '@/lib/legal/content';
import styles from './LegalPage.module.css';

/** Renders a policy/legal document from structured content. */
export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const updated = new Date(doc.updated).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article className={`${styles.wrap} container section-padding`}>
      <h1 className={`${styles.title} gradient-text`}>{doc.title}</h1>
      <p className={styles.updated}>Last updated {updated}</p>
      <p className={styles.intro}>{doc.intro}</p>

      {doc.sections.map((section) => (
        <section key={section.heading} className={styles.section}>
          <h2 className={styles.heading}>{section.heading}</h2>
          {section.body.map((paragraph, i) => (
            <p key={i} className={styles.paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </article>
  );
}

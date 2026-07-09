import Link from 'next/link';
import styles from './Breadcrumbs.module.css';

export interface Crumb {
  label: string;
  href?: string;
}

/** Accessible breadcrumb trail. The last crumb is the current page (no link). */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.nav}>
      <ol className={styles.list}>
        {items.map((crumb, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className={styles.item}>
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className={styles.link}>{crumb.label}</Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className={styles.current}>{crumb.label}</span>
              )}
              {!isLast && <span className={styles.sep} aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

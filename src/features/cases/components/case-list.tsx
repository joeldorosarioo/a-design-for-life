import type { CaseCardDTO } from '../contracts/case-dto.schema';
import type { CaseMediaMode } from './case-image';
import { CaseCard } from './case-card';
import { CaseProse } from './case-text';
import { buttonVariants } from '@/components/ui/button';
import styles from '../stylesheets/cases.module.css';
export type CaseGridProps = {
  cases: CaseCardDTO[];
  caseLinkLabel: string | null;
  emptyState: { title: string; description: string };
  headingLevel?: 2 | 3;
  mediaMode?: CaseMediaMode;
};
export type CaseListProps = CaseGridProps & {
  opening: { eyebrow: string | null; title: string | null; description: string | null };
  homeHref: string;
  homeLabel: string;
  countLabel: string;
};
export function CaseGrid({
  cases,
  caseLinkLabel,
  emptyState,
  headingLevel = 2,
  mediaMode,
}: CaseGridProps) {
  if (!cases.length) {
    const Heading = headingLevel === 2 ? 'h2' : 'h3';
    return (
      <div className={styles.empty}>
        <Heading>{emptyState.title}</Heading>
        <CaseProse text={emptyState.description} />
      </div>
    );
  }
  return (
    <ul className={styles.caseGrid}>
      {cases.map((caseCard) => (
        <li key={caseCard.caseId}>
          <CaseCard
            caseCard={caseCard}
            caseLinkLabel={caseLinkLabel}
            headingLevel={headingLevel}
            mediaMode={mediaMode}
          />
        </li>
      ))}
    </ul>
  );
}
export function CaseList({ opening, homeHref, homeLabel, countLabel, ...grid }: CaseListProps) {
  return (
    <div className={`portfolio-container ${styles.listing}`}>
      <header className={styles.listingOpening} data-reading-key="cases-opening">
        <a href={homeHref} className={styles.textLink}>
          <span aria-hidden="true">← </span>
          {homeLabel}
        </a>
        <div className={styles.sectionHeading}>
          {opening.eyebrow ? <p className={styles.eyebrow}>{opening.eyebrow}</p> : null}
          {opening.title ? <h1 className={styles.listingTitle}>{opening.title}</h1> : null}
          <CaseProse text={opening.description} />
          <p className={styles.count}>
            {grid.cases.length} {countLabel}
          </p>
        </div>
      </header>
      <div data-reading-key="cases-list">
        <CaseGrid {...grid} />
      </div>
    </div>
  );
}
/** Root selects published copy and the actual HTTP response status. */
export function CaseState({
  title,
  description,
  links = [],
}: {
  title: string;
  description: string;
  links?: { href: string; label: string }[];
}) {
  return (
    <section className={`portfolio-container ${styles.state}`}>
      <h1 className={styles.sectionTitle}>{title}</h1>
      <CaseProse text={description} />
      {links.length ? (
        <ul className={styles.stateLinks}>
          {links.map((link) => (
            <li key={`${link.href}-${link.label}`}>
              <a href={link.href} className={buttonVariants({ variant: 'secondary' })}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

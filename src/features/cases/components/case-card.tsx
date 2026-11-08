import { Card, CardContent } from '@/components/ui/card';
import type { CaseCardDTO } from '../contracts/case-dto.schema';
import { CaseImage, type CaseMediaMode } from './case-image';
import { CaseProse } from './case-text';
import styles from '../stylesheets/cases.module.css';
export function CaseCard({
  caseCard,
  caseLinkLabel,
  headingLevel = 2,
  mediaMode,
}: {
  caseCard: CaseCardDTO;
  caseLinkLabel: string | null;
  headingLevel?: 2 | 3;
  mediaMode?: CaseMediaMode;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Card variant="flush" data-reading-key={`case-card:${caseCard.caseId}`}>
      <CaseImage image={caseCard.cover} kind="card" mediaMode={mediaMode} />
      <CardContent className={styles.cardCopy}>
        {caseCard.eyebrow ? <p className={styles.eyebrow}>{caseCard.eyebrow}</p> : null}
        {caseCard.title ? (
          <Heading className={styles.cardTitle}>
            <a href={caseCard.path}>{caseCard.title}</a>
          </Heading>
        ) : null}
        <CaseProse text={caseCard.summary} />
        {caseLinkLabel?.trim() ? (
          <a
            className={styles.textLink}
            href={caseCard.path}
            aria-label={caseCard.title ? `${caseLinkLabel}: ${caseCard.title}` : caseLinkLabel}
          >
            {caseLinkLabel}
            <span aria-hidden="true"> →</span>
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

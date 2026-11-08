import { Card, CardContent } from '@/components/ui/card';
import type { CaseCardDTO } from '../contracts/case-dto.schema';
import { CaseImage, type CaseMediaMode } from './case-image';
import { CaseProse, caseEyebrowClass, caseTextLinkClass } from './case-text';
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
      <CardContent>
        {caseCard.eyebrow ? <p className={caseEyebrowClass}>{caseCard.eyebrow}</p> : null}
        {caseCard.title ? (
          <Heading className="m-0 text-2xl font-semibold lg:text-3xl">
            <a
              href={caseCard.path}
              className="text-inherit no-underline [&:hover]:underline [&:hover]:underline-offset-[0.15em]"
            >
              {caseCard.title}
            </a>
          </Heading>
        ) : null}
        <CaseProse text={caseCard.summary} />
        {caseLinkLabel?.trim() ? (
          <a
            className={`${caseTextLinkClass} -my-3`}
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

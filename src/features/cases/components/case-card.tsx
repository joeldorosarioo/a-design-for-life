import { cn } from 'cn';
import { PortfolioLink } from '@/components/portfolio-link';
import { Card, CardContent } from '@/components/ui/card';
import type { CaseCardDTO } from '../contracts/case-dto.schema';
import { caseCoverTransitionName, caseOpenTransitionTypes } from './case-entry-motion';
import { CaseOpeningLink } from './case-opening-status';
import { CaseImage, type CaseMediaMode } from './case-image';
import { CaseProse, caseEyebrowClass, caseTextLinkClass } from './case-text';
export function CaseCard({
  caseCard,
  caseLinkLabel,
  headingLevel = 2,
  mediaMode,
  priority = false,
}: {
  caseCard: CaseCardDTO;
  caseLinkLabel: string | null;
  headingLevel?: 2 | 3;
  mediaMode?: CaseMediaMode;
  priority?: boolean;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const published = mediaMode !== 'preview';
  const coverName = published ? caseCoverTransitionName(caseCard) : undefined;
  const CardLink = published ? CaseOpeningLink : PortfolioLink;
  const linkMotion = published
    ? { caseLocale: caseCard.locale, transitionTypes: caseOpenTransitionTypes }
    : undefined;
  return (
    <Card
      variant="flush"
      className={published ? 'relative grid-cols-1' : undefined}
      data-reading-key={`case-card:${caseCard.caseId}`}
    >
      <CaseImage
        image={caseCard.cover}
        kind="card"
        mediaMode={mediaMode}
        priority={priority}
        transitionName={coverName}
      />
      <CardContent>
        {caseCard.eyebrow ? <p className={caseEyebrowClass}>{caseCard.eyebrow}</p> : null}
        {caseCard.title ? (
          <Heading className="m-0 text-2xl font-semibold lg:text-3xl">
            <CardLink
              href={caseCard.path}
              aria-label={caseCard.title}
              {...linkMotion}
              className={cn(
                'text-inherit no-underline [&:hover]:underline [&:hover]:underline-offset-[0.15em]',
                coverName &&
                  'after:absolute after:inset-0 after:col-[1/2] after:row-[1/2] after:z-10',
              )}
            >
              {caseCard.title}
            </CardLink>
          </Heading>
        ) : null}
        <CaseProse text={caseCard.summary} />
        {caseLinkLabel?.trim() ? (
          <CardLink
            className={`${caseTextLinkClass} -my-3`}
            href={caseCard.path}
            {...linkMotion}
            aria-label={caseCard.title ? `${caseLinkLabel}: ${caseCard.title}` : caseLinkLabel}
          >
            {caseLinkLabel}
            <span aria-hidden="true"> →</span>
          </CardLink>
        ) : null}
      </CardContent>
    </Card>
  );
}

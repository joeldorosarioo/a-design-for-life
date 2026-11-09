import { PortfolioLink } from '@/components/portfolio-link';
import type { CaseCardDTO } from '../contracts/case-dto.schema';
import type { CaseMediaMode } from './case-image';
import { CaseCard } from './case-card';
import { CaseProse, caseEyebrowClass, caseTextLinkClass } from './case-text';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
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
      <Empty>
        <Heading className="m-0 text-2xl">{emptyState.title}</Heading>
        <CaseProse text={emptyState.description} />
      </Empty>
    );
  }
  return (
    <ul className="m-0 grid list-none gap-8 p-0 md:grid-cols-2">
      {cases.map((caseCard) => (
        <li key={caseCard.caseId} className="min-w-0">
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
    <div className="portfolio-container grid min-w-0 gap-12 py-6 wrap-anywhere lg:gap-28 lg:py-20">
      <header className="grid gap-6" data-reading-key="cases-opening">
        <PortfolioLink href={homeHref} className={`${caseTextLinkClass} -my-3`}>
          <span aria-hidden="true">← </span>
          {homeLabel}
        </PortfolioLink>
        <div className="grid min-w-0 gap-6">
          {opening.eyebrow ? <p className={caseEyebrowClass}>{opening.eyebrow}</p> : null}
          {opening.title ? (
            <h1 className="m-0 font-serif text-5xl font-normal whitespace-pre-line lg:text-7xl">
              {opening.title}
            </h1>
          ) : null}
          <CaseProse text={opening.description} className="text-lg" />
          <p className="m-0 text-sm font-semibold text-primary">
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
    <section className="portfolio-container grid min-w-0 gap-6 py-20 wrap-anywhere">
      <h1 className="m-0 text-3xl font-semibold whitespace-pre-line lg:text-4xl">{title}</h1>
      <CaseProse text={description} />
      {links.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-4 p-0">
          {links.map((link) => (
            <li key={`${link.href}-${link.label}`}>
              <Button asChild>
                <PortfolioLink href={link.href}>{link.label}</PortfolioLink>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

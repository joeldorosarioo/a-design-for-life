import { PortfolioLink } from '@/components/portfolio-link';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import type { ProfileDTO } from '../contracts/profile-dto.schema';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProfileImage } from './profile-image';

export const profileEyebrowClass = 'text-xs font-semibold text-[color:var(--action-default)]';
export const profileLinkClass =
  'text-sm font-semibold text-[color:var(--action-default)] no-underline [&:hover]:text-[color:var(--action-hover)] [&:hover]:underline';
const itemTitleClass = 'text-2xl font-semibold';

export type HomeContentProps = {
  profile: ProfileDTO;
  /** Destinations are supplied by the validated navigation at the composition root. */
  projectsHref: string;
  aboutHref: string;
  /** Cases owns this slot's data, empty state and cards. */
  featuredProjects: ReactNode;
  mediaMode?: 'published' | 'preview';
};

/** Profile copy is plain text: blank lines separate paragraphs; single newlines remain line breaks. */
export function ProfileProse({
  text,
  className = '',
}: {
  text: string | null;
  className?: string;
}) {
  if (!text) return null;
  return (
    <div
      className={cn(
        'text-base text-muted-foreground [&>p]:whitespace-pre-line [&>p+p]:mt-6',
        className,
      )}
    >
      {text
        .split(/\r?\n[\t ]*\r?\n+/)
        .filter((paragraph) => paragraph.trim())
        .map((paragraph, index) => (
          <p key={`${index}-${paragraph}`}>{paragraph}</p>
        ))}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  editorial = false,
}: {
  eyebrow: string | null;
  title: string | null;
  description: string | null;
  editorial?: boolean;
}) {
  return (
    <div className={cn('grid min-w-0', editorial ? 'gap-6' : 'gap-4')}>
      {eyebrow ? <p className={profileEyebrowClass}>{eyebrow}</p> : null}
      {title ? (
        <h2
          className={cn(
            'text-4xl whitespace-pre-line lg:text-5xl',
            editorial ? 'font-serif font-normal' : 'font-semibold',
          )}
        >
          {title}
        </h2>
      ) : null}
      <ProfileProse text={description} className={editorial ? undefined : 'text-lg'} />
    </div>
  );
}

export function HomeContent({
  profile,
  projectsHref,
  aboutHref,
  featuredProjects,
  mediaMode = 'published',
}: HomeContentProps) {
  const { home, homeProjects, homeAbout, approach } = profile;
  const trajectory = homeAbout.trajectory.filter(
    (item) => item.period || item.title || item.description,
  );
  const methods = approach.methods.filter(
    (item) => item.title || item.description || item.keywords,
  );
  return (
    <div className="wrap-anywhere">
      <section
        className="portfolio-container grid items-start gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-16 lg:pt-20 lg:pb-24"
        data-reading-key="home-hero"
      >
        <div className="min-w-0">
          {home.eyebrow ? <p className={profileEyebrowClass}>{home.eyebrow}</p> : null}
          {home.title || home.titleEmphasis ? (
            <h1 className="my-6 text-5xl font-semibold whitespace-pre-line lg:text-7xl">
              {home.title}
              {home.title && home.titleEmphasis ? ' ' : null}
              {home.titleEmphasis ? (
                <span className="mt-6 block font-serif font-normal text-[color:var(--action-default)]">
                  {home.titleEmphasis}
                </span>
              ) : null}
            </h1>
          ) : null}
          <ProfileProse text={home.description} className="mb-6 text-lg" />
          {home.projectsLabel ? (
            <Button asChild variant="primary" className="min-w-[min(13rem,100%)] justify-start">
              <PortfolioLink href={projectsHref}>
                {home.projectsLabel}
                <span aria-hidden="true">→</span>
              </PortfolioLink>
            </Button>
          ) : null}
        </div>
        <ProfileImage image={home.portrait} kind="portrait" mediaMode={mediaMode} />
      </section>

      <section
        className="portfolio-container grid gap-8 py-6 lg:gap-12 lg:pt-16 lg:pb-20"
        data-reading-key="home-projects"
      >
        <SectionHeading {...homeProjects} />
        {featuredProjects}
      </section>

      <section className="bg-muted" data-reading-key="home-about">
        <div className="portfolio-container grid gap-12 py-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:gap-16 lg:py-20">
          <div className="min-w-0">
            <SectionHeading {...homeAbout} editorial />
            {homeAbout.aboutLabel ? (
              <PortfolioLink href={aboutHref} className={cn(profileLinkClass, 'mt-6 inline-block')}>
                {homeAbout.aboutLabel}
                <span aria-hidden="true"> →</span>
              </PortfolioLink>
            ) : null}
          </div>
          {trajectory.length > 0 ? (
            <ol className="grid list-none gap-10 lg:pt-2">
              {trajectory.map((item) => (
                <li
                  key={item.readingKey ?? item.period ?? item.title ?? item.description}
                  data-reading-key={item.readingKey ?? undefined}
                >
                  {item.period ? <p className={profileEyebrowClass}>{item.period}</p> : null}
                  {item.title ? <h3 className={cn(itemTitleClass, 'my-2')}>{item.title}</h3> : null}
                  <ProfileProse text={item.description} />
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </section>

      <section
        className="portfolio-container grid gap-8 py-6 lg:gap-12 lg:py-20"
        data-reading-key="home-approach"
      >
        <SectionHeading {...approach} />
        {methods.length > 0 ? (
          <ol className="grid list-none gap-6 lg:grid-cols-3 lg:gap-10">
            {methods.map((method, index) => (
              <Card
                as="li"
                className="lg:min-h-[16.625rem]"
                key={method.readingKey ?? method.title ?? method.description ?? method.keywords}
                data-reading-key={method.readingKey ?? undefined}
              >
                <span className="text-sm text-[color:var(--action-default)]" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {method.title ? <h3 className={itemTitleClass}>{method.title}</h3> : null}
                <ProfileProse text={method.description} />
                {method.keywords ? (
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {method.keywords}
                  </p>
                ) : null}
              </Card>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}

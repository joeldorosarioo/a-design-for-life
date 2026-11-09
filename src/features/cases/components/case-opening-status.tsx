'use client';

import { useEffect, type ComponentPropsWithoutRef } from 'react';
import { useLinkStatus } from 'next/link';
import { useReducedMotion } from 'motion/react';
import { useAnimate } from 'motion/react-mini';
import { PortfolioLink } from '@/components/portfolio-link';
import { Skeleton } from '@/components/ui/skeleton';
import { caseMotion } from '@/helpers/motion/tokens';
import type { Locale } from '@/helpers/i18n/locale.schema';
import { rememberCaseOpening } from './case-view-motion';

export function CaseOpeningLink({
  caseLocale,
  href,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof PortfolioLink>, 'onNavigate'> & { caseLocale?: Locale }) {
  return (
    <PortfolioLink {...props} href={href} onNavigate={() => rememberCaseOpening(href)}>
      {children}
      {caseLocale && <CaseOpeningStatus locale={caseLocale} />}
    </PortfolioLink>
  );
}

function CaseOpeningStatus({ locale }: { locale: Locale }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {pending ? (locale === 'pt' ? 'Abrindo case…' : 'Opening case…') : null}
      </span>
      {pending && <PendingSkeleton />}
    </>
  );
}

function PendingSkeleton() {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const reveal = animate(scope.current, { opacity: [0, 1] }, caseMotion.pendingReveal);
    const pulse = animate(
      '[data-slot="skeleton"]',
      { opacity: [1, 0.48, 1] },
      caseMotion.pendingPulse,
    );
    return () => {
      reveal.cancel();
      pulse.cancel();
    };
  }, [animate, reducedMotion, scope]);

  return (
    <span
      ref={scope}
      data-case-opening-pending
      aria-hidden="true"
      style={{ opacity: reducedMotion ? 1 : 0 }}
      className="pointer-events-none absolute end-3 top-3 z-20 grid gap-1 rounded-lg border border-border bg-background px-3 py-2"
    >
      <Skeleton className="h-2 w-11" />
      <Skeleton className="h-2 w-7" />
    </span>
  );
}

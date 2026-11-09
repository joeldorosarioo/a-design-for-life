'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AnimateView } from 'motion/react-animate-view';
import { caseMotion } from '@/helpers/motion/tokens';
import { caseOpenTransitionType } from './case-entry-motion';

const immediate = { transition: { duration: 0 } };
const cover = { transition: caseMotion.cover };
const content = {
  opacity: [0, 1],
  transform: ['translateY(8px)', 'translateY(0px)'],
  transition: caseMotion.content,
};

let pendingCasePath: string | undefined;

export function rememberCaseOpening(pathname: string) {
  pendingCasePath = pathname;
}

export function discardUnmatchedCaseOpening(pathname: string) {
  if (pendingCasePath !== pathname) pendingCasePath = undefined;
}

function isCaseOpening(types: string[]) {
  return (
    types.includes(caseOpenTransitionType) ||
    document.activeViewTransition?.types?.has(caseOpenTransitionType)
  );
}

export function CaseCoverMotion({ name, children }: { name: string; children: ReactNode }) {
  return (
    <AnimateView
      name={name}
      enter={immediate}
      exit={immediate}
      update={immediate}
      share={(types) => (isCaseOpening(types) ? cover : immediate)}
    >
      {children}
    </AnimateView>
  );
}

export function CaseEntryContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (pendingCasePath !== pathname) return;
    pendingCasePath = undefined;
    // An intermediate pending commit can consume the type queued by Link.
    document.activeViewTransition?.types?.add(caseOpenTransitionType);
  }, [pathname]);

  return (
    <AnimateView
      enter={(types) => (isCaseOpening(types) ? content : immediate)}
      exit={immediate}
      update={immediate}
    >
      {children}
    </AnimateView>
  );
}

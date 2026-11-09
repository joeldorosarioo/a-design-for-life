'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { animate } from 'motion/mini';
import { useReducedMotion } from 'motion/react';
import { discardUnmatchedCaseOpening } from '@/features/cases/ui';
import { pageMotion } from '@/helpers/motion/tokens';

export function PublicPageMotion() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const changed = previousPathname.current !== pathname;
    previousPathname.current = pathname;
    if (!changed) return;
    discardUnmatchedCaseOpening(pathname);
    if (reducedMotion) return;

    const page = Array.from(
      document.querySelectorAll<HTMLElement>('main[data-page-transition]'),
    ).find(
      (element) =>
        element.dataset.pageTransition === pathname && element.getClientRects().length > 0,
    );
    if (!page) return;

    const entrance = animate(page, { opacity: [0.25, 1] }, pageMotion);
    return () => entrance.cancel();
  }, [pathname, reducedMotion]);

  return null;
}

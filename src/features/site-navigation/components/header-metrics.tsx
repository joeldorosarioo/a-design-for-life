'use client';
import { useLayoutEffect, useRef } from 'react';
export function HeaderMetrics() {
  const marker = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const header = marker.current?.closest('header');
    if (!header) return;
    const update = () =>
      document.documentElement.style.setProperty(
        '--portfolio-header-height',
        `${header.getBoundingClientRect().height}px`,
      );
    update();
    // The browser may resolve the initial hash before hydration measures a tall
    // mobile Header. Correct only that initially occluded target, once.
    try {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (target) {
        const top = target.getBoundingClientRect().top;
        const line = Math.max(0, header.getBoundingClientRect().bottom) + 24;
        if (top >= 0 && top < line) window.scrollBy({ top: top - line, behavior: 'instant' });
      }
    } catch {
      // An invalid escaped hash has no native target to correct.
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(header);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      if (
        document.querySelector('[data-portfolio-header]') === header ||
        !document.querySelector('[data-portfolio-header]')
      )
        document.documentElement.style.removeProperty('--portfolio-header-height');
    };
  }, []);
  return <span hidden ref={marker} aria-hidden="true" />;
}

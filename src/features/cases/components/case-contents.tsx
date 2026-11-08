'use client';

import { useEffect, useState } from 'react';

export type CaseContentsEntry = { readingKey: string; label: string; anchor: string };
export function CaseContents({ entries, label }: { entries: CaseContentsEntry[]; label: string }) {
  const [activeAnchor, setActiveAnchor] = useState(entries[0]?.anchor);
  const current = entries.some((entry) => entry.anchor === activeAnchor)
    ? activeAnchor
    : entries[0]?.anchor;

  useEffect(() => {
    const followHash = () => {
      const anchor = window.location.hash.slice(1);
      if (entries.some((entry) => entry.anchor === anchor)) setActiveAnchor(anchor);
    };
    followHash();
    const resetBeforeArticle = () => {
      const first = entries[0];
      const section = first && document.getElementById(first.anchor);
      if (first && section && section.getBoundingClientRect().top > 0)
        setActiveAnchor(first.anchor);
    };
    window.addEventListener('hashchange', followHash);
    // Both footer and opening can be outside every observed article section.
    window.addEventListener('scroll', resetBeforeArticle, { passive: true });
    if (typeof IntersectionObserver === 'undefined')
      return () => {
        window.removeEventListener('hashchange', followHash);
        window.removeEventListener('scroll', resetBeforeArticle);
      };
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (changes) => {
        for (const change of changes) {
          if (change.isIntersecting) visible.set(change.target.id, change.boundingClientRect.top);
          else visible.delete(change.target.id);
        }
        const closest = [...visible].sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0];
        if (closest) setActiveAnchor(closest[0]);
        else resetBeforeArticle();
      },
      { rootMargin: '-10% 0px -65% 0px', threshold: 0 },
    );
    for (const entry of entries) {
      const section = document.getElementById(entry.anchor);
      if (section) observer.observe(section);
    }
    return () => {
      window.removeEventListener('hashchange', followHash);
      window.removeEventListener('scroll', resetBeforeArticle);
      observer.disconnect();
    };
  }, [entries]);

  if (!entries.length) return null;
  return (
    <nav
      aria-label={label}
      className="min-w-0 lg:sticky lg:top-[calc(var(--portfolio-header-height,6rem)+var(--space-8))]"
    >
      <p className="m-0 mb-4 font-semibold after:mt-4 after:block after:h-0.5 after:w-9 after:bg-primary after:content-['']">
        {label}
      </p>
      <ol className="m-0 grid list-none grid-cols-2 gap-x-4 p-0 lg:grid-cols-1">
        {entries.map((entry) => (
          <li key={entry.readingKey}>
            <a
              href={`#${entry.anchor}`}
              className="flex min-h-11 items-center text-sm text-muted-foreground no-underline wrap-anywhere aria-[current=location]:font-semibold aria-[current=location]:text-primary [&:hover]:underline [&:hover]:underline-offset-[0.2em]"
              aria-current={current === entry.anchor ? 'location' : undefined}
              onClick={() => setActiveAnchor(entry.anchor)}
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

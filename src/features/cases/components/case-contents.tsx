'use client';

import { useEffect, useState } from 'react';
import styles from '../stylesheets/cases.module.css';

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
    <nav aria-label={label} className={styles.contents}>
      <p className={styles.contentsTitle}>{label}</p>
      <ol className={styles.contentsLinks}>
        {entries.map((entry) => (
          <li key={entry.readingKey}>
            <a
              href={`#${entry.anchor}`}
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

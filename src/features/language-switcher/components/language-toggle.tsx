'use client';

import { useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { LanguageToggleProps } from '../contracts/language-control.schema';
import { useReadingPosition } from './reading-position-provider';
import styles from '../stylesheets/language-switcher.module.css';

export function LanguageToggle(props: LanguageToggleProps) {
  const { pending, begin, register } = useReadingPosition();
  const { locale, pathname, sourcePage, status = 200 } = props;
  const caseId = sourcePage.kind === 'case' ? sourcePage.caseId : null;
  useLayoutEffect(() => {
    register({
      locale,
      pathname,
      status,
      sourcePage: caseId ? { kind: 'case', caseId } : sourcePage,
    });
  }, [register, locale, pathname, sourcePage, caseId, status]);
  const label = locale === 'pt' ? 'English' : 'Português';
  return (
    <Button
      data-language-toggle
      className={styles.toggle}
      aria-label={label}
      lang={locale === 'pt' ? 'en' : 'pt'}
      title={`${props.labels.languageLabel}: ${label}`}
      disabled={pending || props.destination.kind === 'unavailable'}
      aria-busy={pending}
      onClick={() => {
        void begin(props);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- exact approved static Figma language vector */}
      <img
        src={locale === 'pt' ? '/figma/language-en.svg' : '/figma/language-br.svg'}
        width={32}
        height={32}
        alt=""
      />
    </Button>
  );
}

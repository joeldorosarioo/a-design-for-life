import type { Locale } from '@/helpers/i18n/locale.schema';
import styles from '../stylesheets/language-switcher.module.css';

/** The reference identifies the current language; the containing action names its destination. */
export function LanguageFlag({ locale }: { locale: Locale }) {
  const brazil = locale === 'pt';
  return (
    <span className={styles.flagRing} aria-hidden="true">
      <span className={styles.flagClip}>
        {/* eslint-disable-next-line @next/next/no-img-element -- exact approved static Figma language vector */}
        <img
          className={brazil ? styles.brazilFlag : styles.flag}
          src={brazil ? '/figma/language-br.svg' : '/figma/language-en.svg'}
          width={brazil ? 46 : 32}
          height={32}
          alt=""
        />
      </span>
    </span>
  );
}

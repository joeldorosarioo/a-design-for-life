import type { Locale } from '@/helpers/i18n/locale.schema';

export const languageButtonClass =
  'min-h-12 w-12 shrink-0 rounded-full border-0 bg-background p-1 not-disabled:hover:bg-background';
export const flagRingClass =
  'grid size-10 shrink-0 place-items-center rounded-full border border-input';

/** The reference identifies the current language; the containing action names its destination. */
export function LanguageFlag({ locale }: { locale: Locale }) {
  const brazil = locale === 'pt';
  return (
    <span className={flagRingClass} aria-hidden="true">
      <span className="block size-8 overflow-hidden rounded-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- exact approved static Figma language vector */}
        <img
          className={brazil ? 'block max-w-none -translate-x-[7px]' : 'block max-w-none'}
          src={brazil ? '/figma/language-br.svg' : '/figma/language-en.svg'}
          width={brazil ? 46 : 32}
          height={32}
          alt=""
        />
      </span>
    </span>
  );
}

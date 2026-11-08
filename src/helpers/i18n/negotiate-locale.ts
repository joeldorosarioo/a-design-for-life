import type { Locale } from './locale.schema';

const languageRange = /^[a-z]{1,8}(?:-[a-z0-9]{1,8})*$/i;
const qualityWeight = /^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i;

/** Select a supported language by quality, then header order; default to English. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  let selected: Locale = 'en';
  let selectedQuality = 0;

  for (const entry of acceptLanguage?.split(',') ?? []) {
    const [range, weight, ...extraParameters] = entry.trim().split(';');
    const tag = range.trim();
    if (!languageRange.test(tag) || extraParameters.length > 0) continue;

    const locale = tag.split('-')[0].toLowerCase();
    if (locale !== 'pt' && locale !== 'en') continue;

    const quality = weight === undefined ? 1 : qualityWeight.exec(weight.trim());
    if (quality === null) continue;
    const value = quality === 1 ? quality : Number(quality[1]);
    if (value > selectedQuality) {
      selected = locale;
      selectedQuality = value;
    }
  }

  return selected;
}

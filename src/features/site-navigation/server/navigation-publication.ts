import 'server-only';
import type { SiteNavigation } from '@/payload-types';
import type { PublicationAdapter } from '@/helpers/payload/publication-updates';
import { z } from 'zod';
export const navigationPublicationAdapter: PublicationAdapter = {
  apply(root, operation) {
    const target = operation.target as { locale?: string };
    if (
      !Object.values(root?.subjects ?? {}).some((entry) => {
        const value = entry.value as { kind?: string; locale?: string };
        return value.kind === 'profile' && value.locale === target.locale;
      })
    )
      throw new Error('Confirmed profile unavailable.');
    return z.json().parse(operation.target);
  },
  async prepare(document) {
    const doc = document as unknown as SiteNavigation;
    return {
      value: z.json().parse({
        kind: 'navigation',
        locale: doc.locale,
        navigation: {
          locale: doc.locale,
          header: doc.header,
          footer: doc.footer,
          controls: doc.controls,
          messages: doc.messages,
        },
      }),
      dependencies: [`navigation:${doc.locale}`],
    };
  },
};

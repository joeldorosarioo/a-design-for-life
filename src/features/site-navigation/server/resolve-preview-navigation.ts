import 'server-only';
import {
  buildPrivatePreviewPath,
  type PrivatePreviewPageScope,
} from '@/helpers/payload/private-preview-path';
import {
  previewNavigationPresentationDTOSchema,
  type PreviewNavigationPresentationDTO,
} from '../contracts/preview-navigation-presentation-dto.schema';
import { resolveNavigation, type ResolveNavigationInput } from './resolve-navigation';
export type ResolvePreviewNavigationInput = ResolveNavigationInput & {
  pageScope: PrivatePreviewPageScope;
};
export function resolvePreviewNavigation(
  input: ResolvePreviewNavigationInput,
): PreviewNavigationPresentationDTO {
  const navigation = resolveNavigation(input);
  const path = (page: 'home' | 'about' | 'cases') =>
    buildPrivatePreviewPath({ ...input.pageScope, locale: input.locale, page });
  return previewNavigationPresentationDTOSchema.parse({
    ...navigation,
    brand: { ...navigation.brand, href: path('home') },
    items: [
      { ...navigation.items[0], destination: { kind: 'page', href: path('cases') } },
      { ...navigation.items[1], destination: { kind: 'page', href: path('about') } },
      {
        ...navigation.items[2],
        destination: {
          kind: 'resume',
          href: `/preview-media/${input.profile.resumeId}/original`,
          newTab: true,
        },
      },
      navigation.items[3],
    ],
  });
}

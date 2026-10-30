import type { Metadata } from 'next';
import { readPrivatePageRequest } from '@/config/private-page-request';
import { resolvePreviewContextualLink } from '@/features/cases/server';
import { PublicPageView } from '@/app/(portfolio)/_components/public-page-view';
import { parsePrivatePreviewPath } from '@/helpers/payload/private-preview-path';

type PageProps = {
  params: Promise<{ locale: string; collection: string; id: string; page: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export default async function PrivatePreviewPage({ params, searchParams }: PageProps) {
  const { locale, collection, id, page } = await params;
  const pathname = `/preview-ui/${locale}/${collection}/${id}/${page}`;
  parsePrivatePreviewPath(pathname);
  const query = new URLSearchParams();
  for (const [key, values] of Object.entries(await searchParams))
    for (const value of Array.isArray(values) ? values : values === undefined ? [] : [values])
      query.append(key, value);
  const result = await readPrivatePageRequest(pathname, query.toString());
  // Proxy rejects normal denials before streaming. A failure arising after that
  // decision also fails closed here; never fill a private page with public data.
  if (!result.ok) throw new Error('Private preview unavailable.');
  const model = result.value;
  return (
    <PublicPageView
      locale={model.locale}
      kind={model.kind}
      portfolio={model.portfolio}
      detail={model.detail}
      targets={model.targets}
      navigationOverride={model.navigation}
      resolveLink={(link) => resolvePreviewContextualLink(link, model.routeContext)}
      mediaMode="preview"
    />
  );
}
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'pt' ? 'Prévia do portfólio' : 'Portfolio preview',
    robots: { index: false, follow: false },
    alternates: null,
    openGraph: null,
    twitter: null,
  };
}
export const dynamic = 'force-dynamic';

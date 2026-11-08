import type { Metadata } from 'next';
import { readPublicPageRequest } from '@/config/public-page-request';
import { PublicPageView } from '../_components/public-page-view';
export async function generateMetadata(): Promise<Metadata> {
  const snapshot = await readPublicPageRequest();
  return {
    title: snapshot?.context.locale === 'pt' ? 'Página não encontrada' : 'Page not found',
    robots: { index: false, follow: false },
  };
}
export default async function PublicNotFound() {
  const snapshot = await readPublicPageRequest();
  return (
    <PublicPageView
      kind="home"
      locale={snapshot?.context.locale ?? 'en'}
      portfolio={snapshot?.portfolio ?? null}
      status={404}
    />
  );
}

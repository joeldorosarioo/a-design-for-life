import { publicPageMetadata, renderPublicPage } from '../../_components/public-page-response';

type Props = { params: Promise<{ locale: string; unmatched: string[] }> };

// Technical404 transport only; it never creates another product page or reads Native.
export async function generateMetadata({ params }: Props) {
  const { locale, unmatched } = await params;
  return publicPageMetadata('home', locale, `/${locale}/${unmatched.join('/')}`);
}

export default async function UnmatchedPage({ params }: Props) {
  const { locale, unmatched } = await params;
  return renderPublicPage('home', locale, `/${locale}/${unmatched.join('/')}`);
}

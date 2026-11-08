import { publicPageMetadata, renderPublicPage } from '../../../_components/public-page-response';
type Props = { params: Promise<{ locale: string; slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return publicPageMetadata('case', locale, `/${locale}/cases/${slug}`);
}
export default async function CasePage({ params }: Props) {
  const { locale, slug } = await params;
  return renderPublicPage('case', locale, `/${locale}/cases/${slug}`);
}

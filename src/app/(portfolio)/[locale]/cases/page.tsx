import { publicPageMetadata, renderPublicPage } from '../../_components/public-page-response';
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return publicPageMetadata('cases', locale, `/${locale}/cases`);
}
export default async function CasesPage({ params }: Props) {
  const { locale } = await params;
  return renderPublicPage('cases', locale, `/${locale}/cases`);
}

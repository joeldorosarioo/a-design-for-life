import 'server-only';
import type { PayloadRequest } from 'payload';

export async function ensureNavigationDrafts(req: PayloadRequest): Promise<void> {
  for (const locale of ['pt', 'en'] as const) {
    const existing = await req.payload.find({
      collection: 'site-navigation',
      where: { locale: { equals: locale } },
      draft: true,
      limit: 1,
      req,
      overrideAccess: false,
    });
    if (existing.totalDocs > 0) continue;
    await req.payload.create({
      collection: 'site-navigation',
      data: { locale, _status: 'draft' },
      draft: true,
      req,
      overrideAccess: false,
    });
  }
}

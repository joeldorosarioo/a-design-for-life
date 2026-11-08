import 'server-only';
import type { PayloadRequest } from 'payload';

export async function ensureProfileDrafts(req: PayloadRequest): Promise<void> {
  for (const locale of ['pt', 'en'] as const) {
    const existing = await req.payload.find({
      collection: 'professional-profiles',
      where: { locale: { equals: locale } },
      draft: true,
      limit: 1,
      req,
      overrideAccess: false,
    });
    if (existing.totalDocs > 0) continue;
    await req.payload.create({
      collection: 'professional-profiles',
      data: { locale, _status: 'draft' },
      draft: true,
      req,
      overrideAccess: false,
    });
  }
}

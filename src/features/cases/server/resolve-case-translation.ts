import 'server-only';
import { publicRootSchema, type PublicRoot } from '@/helpers/payload/public-root';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { runtimePayload } from '@/helpers/payload/runtime';
import { readConfirmedCaseEntries } from './get-published-cases';
import { z } from 'zod';
export type CaseTranslation = { kind: 'published'; href: string } | { kind: 'not-public' };
export async function resolveCaseTranslation(input: {
  caseId: string;
  targetLocale: Locale;
  root: PublicRoot;
}): Promise<Result<CaseTranslation>> {
  const unavailable: Result<CaseTranslation> = {
    ok: false,
    error: { code: 'unavailable', message: 'Confirmed translation unavailable.' },
  };
  try {
    const caseId = z.uuid().parse(input.caseId);
    const targetLocale = localeSchema.parse(input.targetLocale);
    // Runtime validation also forbids undefined from activating an older optional getter's default read.
    const root = publicRootSchema.parse(input.root);
    const { cases } = await readConfirmedCaseEntries(root);
    const target = cases.find((item) => item.caseId === caseId && item.locale === targetLocale);
    if (target)
      return {
        ok: true,
        value: target.detail
          ? { kind: 'published', href: target.detail.path }
          : { kind: 'not-public' },
      };
    // A missing subject is not a negative index. Native metadata can prove absence,
    // but never supply a body/path or grant from a pending/public SQL document.
    const payload = await runtimePayload();
    const { createLocalReq } = await import('payload');
    const fresh = await createLocalReq({}, payload);
    const [history, heads] = await Promise.all([
      payload.db.count({
        collection: 'case-routes',
        where: {
          and: [
            { case: { equals: caseId } },
            { locale: { equals: targetLocale } },
            { everPublished: { equals: true } },
          ],
        },
        req: fresh,
      }),
      payload.db.count({
        collection: 'case-content',
        where: {
          and: [
            { case: { equals: caseId } },
            { locale: { equals: targetLocale } },
            {
              or: [
                { latestPublicationIntent: { exists: true } },
                { _status: { equals: 'published' } },
              ],
            },
          ],
        },
        req: fresh,
      }),
    ]);
    return history.totalDocs === 0 && heads.totalDocs === 0
      ? { ok: true, value: { kind: 'not-public' } }
      : unavailable;
  } catch {
    return unavailable;
  }
}

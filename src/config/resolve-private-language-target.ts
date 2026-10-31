import 'server-only';
import { z } from 'zod';
import { buildPrivatePreviewPath } from '@/helpers/payload/private-preview-path';
import { authorizePrivatePreviewRequest } from './prepare-private-preview-request';
import { readPrivatePageModel } from './read-private-page-model';
import type { PrivatePreviewRequestOptions } from './prepare-private-preview-request';

/** Resolve a saved private counterpart under a fresh Native session, never by translating a slug. */
export async function resolvePrivateLanguageTarget(
  request: Request,
  options: PrivatePreviewRequestOptions,
): Promise<string | null> {
  try {
    const authorized = await authorizePrivatePreviewRequest(request, options);
    if (!authorized.ok) return null;
    const {
      scope,
      context: { req, document },
    } = authorized.value;
    const locale = scope.locale === 'pt' ? 'en' : 'pt';
    const peer = await (async () => {
      if (scope.collection === 'case-content') {
        const parent = document.case;
        const caseId = z
          .uuid()
          .parse(parent && typeof parent === 'object' && 'id' in parent ? parent.id : parent);
        const result = await req.payload.find({
          collection: 'case-content',
          where: { and: [{ case: { equals: caseId } }, { locale: { equals: locale } }] },
          select: { case: true, locale: true },
          draft: true,
          depth: 0,
          limit: 2,
          req,
          overrideAccess: false,
        });
        const candidate = result.docs.length === 1 ? result.docs[0] : null;
        const candidateCase =
          typeof candidate?.case === 'object' ? candidate.case.id : candidate?.case;
        return candidate && candidateCase === caseId ? candidate : null;
      }
      const result = await req.payload.find({
        collection: scope.collection,
        where: { locale: { equals: locale } },
        select: { locale: true },
        draft: true,
        depth: 0,
        limit: 2,
        req,
        overrideAccess: false,
      });
      return result.docs.length === 1 ? result.docs[0] : null;
    })();
    if (!peer || peer.locale !== locale) return null;
    const href = buildPrivatePreviewPath({ ...scope, locale, id: peer.id });
    // Existence alone is not a usable preview. Validate the counterpart's own
    // authorization and complete private presentation without granting a public URL.
    const target = await readPrivatePageModel(
      new Request(new URL(href, options.origin), {
        headers: request.headers,
      }),
      options,
    );
    return target.ok && target.value.locale === locale && target.value.kind === scope.page
      ? href
      : null;
  } catch {
    return null;
  }
}

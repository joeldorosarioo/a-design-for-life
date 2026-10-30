import 'server-only';
import { APIError, type PayloadRequest } from 'payload';
import { validateInput } from '@/helpers/payload/validate-input';
import { reserveCaseRouteSchema, type ReserveCaseRouteInput } from '../contracts/slug.schema';
import { caseResult, type CaseResult } from './case-result';
export async function reserveCaseRoute(
  input: ReserveCaseRouteInput,
  req: PayloadRequest,
): Promise<CaseResult<{ slug: string }>> {
  return caseResult(async () => {
    const command = validateInput(reserveCaseRouteSchema, input, 'case-content', req);
    const doc = await req.payload.findByID({
      collection: 'case-content',
      id: command.contentId,
      draft: true,
      depth: 0,
      overrideAccess: false,
      req,
    });
    if (doc.case !== command.caseId || doc.locale !== command.locale)
      throw new APIError('A reserva deve pertencer ao documento e idioma selecionados.', 400);
    // The caller supplies the observed revision and lease. Reading a draft above
    // verifies identity only; it never authorizes an older form with a fresh head.
    await req.payload.update({
      collection: 'case-content',
      id: command.contentId,
      data: {
        slug: command.slug,
        _status: 'draft',
        editorialRevision: req.headers.get('x-editorial-revision'),
        leaseToken: req.headers.get('x-editorial-lease'),
      },
      draft: true,
      overrideAccess: false,
      overrideLock: false,
      req,
      depth: 0,
    });
    return { slug: command.slug };
  });
}

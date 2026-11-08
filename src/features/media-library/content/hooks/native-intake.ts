import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  APIError,
  Forbidden,
  type PayloadRequest,
  type CollectionBeforeOperationHook,
  type CollectionBeforeChangeHook,
  type CollectionAfterReadHook,
} from 'payload';
import { validateUpload } from '../../server/validate-upload';
import { processImage } from '../../server/process-image';
import { ProcessingBusy, ProcessingGate } from '../../server/processing-gate';
import { mediaRuntime } from '../../server/media-runtime';
import { mediaManifestSchema, type MediaManifest } from '../../contracts/media-manifest.schema';
import type { Media } from '@/payload-types';
import { mediaUsageSchema } from '../../contracts/media-usage.schema';
const receipt = new WeakMap<PayloadRequest, MediaManifest>();
const gateKey = Symbol.for('adfl.media-library.processing-gate');
const gates = globalThis as typeof globalThis & { [gateKey]?: ProcessingGate };
const processingGate = (gates[gateKey] ??= new ProcessingGate());
const extension = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
} as const;
export const guardMediaOperation: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  if (!['create', 'update', 'delete'].includes(operation)) return args;
  if (!req.user || req.user.collection !== 'users') throw new Forbidden(req.t);
  if (!req.transactionID || ('disableTransaction' in args && args.disableTransaction))
    throw new APIError('Media writes require an active transaction.', 400);
  const input = args as unknown as {
    id?: string;
    data?: Record<string, unknown>;
    duplicateFromID?: unknown;
  };
  if (input.duplicateFromID != null)
    throw new APIError('Duplicate uploads must use a new validated file.', 400);
  const data = input.data ?? {};
  if (
    [
      'uploadEdits',
      'crop',
      'focalX',
      'focalY',
      'widthInPixels',
      'heightInPixels',
      '_objectKey',
      'prefix',
    ].some((field) => data[field] != null) ||
    req.searchParams?.has('uploadEdits')
  )
    throw new APIError('Image edits must use a new validated upload.', 400);
  if (['manifest', 'usages', 'guardRevision', 'state'].some((field) => field in data))
    throw new APIError('Technical media fields are server owned.', 400);
  if (operation === 'delete' || operation === 'update') {
    if (!input.id) throw new APIError('Change one media asset at a time.', 400);
    const current = await req.payload.db.findOne({
      collection: 'media',
      where: { id: { equals: input.id } },
      req,
    });
    if (!current) throw new APIError('Media unavailable.', 404);
    const raw = current as unknown as Record<string, unknown>;
    const claimed = await req.payload.db.updateOne({
      collection: 'media',
      req,
      options: { atomic: true },
      where: {
        and: [{ id: { equals: input.id } }, { guardRevision: { equals: raw.guardRevision } }],
      },
      data: { guardRevision: randomUUID() },
    });
    if (!claimed) throw new APIError('Media changed. Try again.', 409);
    const usages = mediaUsageSchema.array().parse(raw.usages ?? []);
    if (operation === 'delete' || data.deletedAt) {
      if (usages.some((use) => use.state === 'confirmed' || use.state === 'pending'))
        throw new APIError('This media is protected by a publication.', 409);
      if (operation === 'delete')
        throw new APIError(
          'Use the media trash so recovery is preserved. Permanent removal is not available.',
          409,
        );
    }
    if (
      req.file ||
      ['filename', 'url', 'thumbnailURL', 'mimeType', 'filesize', 'width', 'height', 'sizes'].some(
        (field) => field in data,
      )
    )
      throw new APIError('File bytes are immutable. Upload a new media asset.', 400);
    return args;
  }
  if (!req.file?.data || !(req.file.data instanceof Uint8Array))
    throw new APIError('A real uploaded file is required. URL import is unavailable.', 400);
  try {
    await processingGate.run(async () => {
      const runtime = mediaRuntime();
      const validated = await validateUpload(
        { bytes: req.file!.data, name: req.file!.name, declaredType: req.file!.mimetype },
        { checkerBinary: runtime.checkerBinary, signal: req.signal },
      );
      if (!validated.ok)
        throw new APIError(
          validated.error.message,
          validated.error.code === 'invalid-input' ? 400 : 503,
          { code: validated.error.code },
          true,
        );
      const upload = validated.value;
      const original = {
        variant: 'original',
        type: upload.type,
        object: await runtime.storage.put(upload.bytes),
        ...(upload.kind === 'image' ? { width: upload.width, height: upload.height } : {}),
      };
      const variants: MediaManifest['variants'] = [];
      if (upload.kind === 'image')
        for (const variant of await processImage(upload))
          variants.push({
            variant: variant.variant,
            type: variant.type,
            width: variant.width,
            height: variant.height,
            object: await runtime.storage.put(variant.bytes),
          });
      receipt.set(req, { revision: randomUUID(), kind: upload.kind, original, variants });
      req.file = {
        ...req.file!,
        data: Buffer.from(upload.bytes),
        size: upload.byteLength,
        name: `${randomUUID()}.${extension[upload.type]}`,
        mimetype: upload.type,
      };
    });
  } catch (error) {
    if (error instanceof ProcessingBusy)
      throw new APIError(error.message, 503, { code: 'busy' }, true);
    if (error instanceof APIError) throw error;
    console.error('Media upload unavailable', { correlationId: randomUUID() });
    throw new APIError(
      'O processamento do arquivo está temporariamente indisponível. Tente novamente.',
      503,
      undefined,
      true,
    );
  }
  return args;
};
export const writeMediaReceipt: CollectionBeforeChangeHook = ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  if (operation === 'create') {
    const manifest = receipt.get(req);
    receipt.delete(req);
    if (!manifest) throw new APIError('Validated upload receipt required.', 403);
    return {
      ...data,
      manifest,
      usages: [],
      guardRevision: randomUUID(),
      state: 'ready',
      mimeType: manifest.original.type,
      filesize: manifest.original.object.byteLength,
      width: manifest.original.width ?? null,
      height: manifest.original.height ?? null,
    };
  }
  return {
    ...data,
    manifest: originalDoc.manifest,
    usages: originalDoc.usages,
    guardRevision: originalDoc.guardRevision,
    state: data.deletedAt ? 'deleted' : data.deletedAt === null ? 'ready' : originalDoc.state,
  };
};
export const mediaEditorView: CollectionAfterReadHook = async ({ doc, req }) => {
  const raw = doc.id
    ? ((await req.payload.db.findOne({
        collection: 'media',
        req,
        where: { id: { equals: doc.id } },
      })) as Media | null)
    : null;
  const parsed = mediaManifestSchema.safeParse(raw?.manifest);
  const variants = parsed.success ? parsed.data.variants : [];
  doc.url = `/preview-media/${doc.id}/original`;
  doc.thumbnailURL = variants?.[0] ? `/preview-media/${doc.id}/${variants[0].variant}` : null;
  delete doc.manifest;
  delete doc.usages;
  delete doc.guardRevision;
  delete doc.state;
  return doc;
};

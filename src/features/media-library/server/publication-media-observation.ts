import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PublicRoot } from '@/helpers/payload/public-root';
import {
  publicOptimizerObservationPath,
  type PublicObservation,
} from '@/helpers/payload/publication-http-verification';
import type { MediaManifest } from '../contracts/media-manifest.schema';
import { preflightUpload } from './preflight-upload';
import { confirmedMedia, publicMediaSnapshotSchema } from './public-media';

const mediaId = z.uuid();
const mediaTarget = z.union([
  z.strictObject({ mediaId, variant: z.string().regex(/^(?:original|w[1-9]\d{0,7})$/) }),
  z.strictObject({ mediaId, optimizer: z.literal(true) }),
]);
const proof = z.strictObject({ removed: z.array(mediaTarget).max(64) });
type MediaTarget = z.infer<typeof mediaTarget>;
type PublicValue = PublicRoot['subjects'][string]['value'];

function routeKey(target: MediaTarget) {
  return target.mediaId + '/' + ('variant' in target ? target.variant : 'optimizer');
}

function optimizerEligible(manifest: MediaManifest | undefined) {
  return (
    manifest?.kind === 'image' &&
    manifest.original.variant === 'original' &&
    manifest.original.type.startsWith('image/')
  );
}

function readMediaObservation(value: PublicValue | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) && 'mediaObservation' in value
    ? proof.parse(value.mediaObservation)
    : undefined;
}

function snapshotTargets(value: PublicValue | undefined): MediaTarget[] {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('media' in value)) return [];
  return publicMediaSnapshotSchema
    .array()
    .parse(value.media)
    .flatMap(({ id, manifest }) => {
      const routes: MediaTarget[] = [{ mediaId: id, variant: 'original' }];
      for (const rendition of manifest.variants)
        routes.push({ mediaId: id, variant: rendition.variant });
      if (optimizerEligible(manifest)) routes.push({ mediaId: id, optimizer: true });
      return routes;
    });
}

export function withPublicMediaObservation(
  value: PublicValue,
  previous: PublicValue | undefined,
  previousAcknowledged: boolean,
): PublicValue {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('media' in value))
    return value;
  const selected = new Set(snapshotTargets(value).map(routeKey));
  const removed = new Map<string, MediaTarget>();
  const previousProof = previousAcknowledged ? undefined : readMediaObservation(previous);
  if (previous !== undefined && !previousAcknowledged && !previousProof)
    throw new Error('Prior public media observation provenance unavailable.');
  for (const target of [...(previousProof?.removed ?? []), ...snapshotTargets(previous)]) {
    const key = routeKey(target);
    if (!selected.has(key)) removed.set(key, target);
  }
  // Keep this inside the existing JSON value for previous builds and backups.
  // These route tokens do not grant access and contain no storage coordinates.
  return { ...value, mediaObservation: proof.parse({ removed: [...removed.values()] }) };
}

function publicContentType(headers: Headers) {
  return headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
}

function matchDeniedMedia(bytes: Uint8Array, headers: Headers) {
  const length = headers.get('content-length');
  return (
    bytes.byteLength === 0 &&
    (length === null || length === '0') &&
    !headers.has('content-range') &&
    (headers.get('cache-control') ?? '')
      .split(',')
      .some((directive) => directive.trim().toLowerCase() === 'no-store')
  );
}

function observeMediaTarget(target: MediaTarget, manifest?: MediaManifest): PublicObservation[] {
  const isDirect = 'variant' in target;
  const path = isDirect
    ? `/media/${target.mediaId}/${target.variant}`
    : publicOptimizerObservationPath(target.mediaId);
  if (isDirect) {
    const rendition =
      target.variant === 'original'
        ? manifest?.original
        : manifest?.variants.find(({ variant }) => variant === target.variant);
    if (rendition) {
      const {
        type,
        object: { byteLength, sha256 },
      } = rendition;
      return [
        {
          path,
          status: 200,
          media: { kind: 'direct', mode: 'get', maxBodyBytes: byteLength },
          matches: (bytes, headers) =>
            publicContentType(headers) === type &&
            bytes.byteLength === byteLength &&
            createHash('sha256').update(bytes).digest('hex') === sha256,
        },
      ];
    }
  } else if (optimizerEligible(manifest)) {
    return [
      {
        path,
        status: 200,
        media: { kind: 'optimizer', mode: 'get', maxBodyBytes: 10_000_000 },
        matches(bytes, headers) {
          const type = publicContentType(headers);
          if (!type?.startsWith('image/')) return false;
          const screened = preflightUpload({ bytes, name: '', declaredType: type });
          return screened.ok && screened.value.type === type;
        },
      },
    ];
  }

  return (['get', 'head', 'range'] as const).map((mode) => ({
    path,
    status: 404,
    media: { kind: isDirect ? 'direct' : 'optimizer', mode, maxBodyBytes: 0 },
    matches: matchDeniedMedia,
  }));
}

export function planPublicMediaObservations(
  root: PublicRoot,
  subject: string,
  requireProvenance = false,
): PublicObservation[] {
  const selected = root.subjects[subject];
  if (!selected) throw new Error('Public media observation requires a selected subject.');
  const selectedProof = readMediaObservation(selected.value);
  if (requireProvenance && !selectedProof)
    throw new Error('Public media observation provenance unavailable.');
  const targets = new Map(
    [...snapshotTargets(selected.value), ...(selectedProof?.removed ?? [])].map((target) => [
      routeKey(target),
      target,
    ]),
  );
  if (!targets.size) return [];
  const grants = new Map<string, MediaManifest>();
  for (const { id, manifest } of confirmedMedia(root)) {
    if (!grants.has(id)) grants.set(id, manifest);
  }
  return [...targets.values()].flatMap((target) =>
    observeMediaTarget(target, grants.get(target.mediaId)),
  );
}

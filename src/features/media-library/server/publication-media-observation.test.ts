import { createHash, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { z } from 'zod';
import type { PublicRoot } from '@/helpers/payload/public-root';
import {
  planPublicMediaObservations as plan,
  withPublicMediaObservation,
} from './publication-media-observation';

type Subject = PublicRoot['subjects'][string];
const selected = `case-content/${randomUUID()}`;
const other = `case-content/${randomUUID()}`;
const mediaId = randomUUID();
const original = `/media/${mediaId}/original`;
const optimizer = `/_next/image?url=${encodeURIComponent(original)}&w=64&q=75`;
const directBytes = Buffer.from('Synthetic stored object');
const stored = {
  byteLength: directBytes.byteLength,
  sha256: createHash('sha256').update(directBytes).digest('hex'),
  key: 'a'.repeat(64),
};
const media = {
  id: mediaId,
  manifest: {
    revision: randomUUID(),
    kind: 'image',
    original: { variant: 'original', type: 'image/png', object: stored },
    variants: [{ variant: 'w16', type: 'image/webp', object: stored }],
  },
};

function entry(value: unknown): Subject {
  return { operationId: randomUUID(), targetRevision: randomUUID(), value: z.json().parse(value) };
}

function scenario(shared: boolean): PublicRoot {
  const previous = { media: [media] };
  const withdrawal = withPublicMediaObservation({ media: [] }, previous, true);
  return {
    generation: randomUUID(),
    subjects: {
      [selected]: entry(withdrawal),
      ...(shared ? { [other]: entry(previous) } : {}),
    },
  };
}

it('checks the exact stored bytes and canonical optimized image while another owner keeps the grant', () => {
  const probes = plan(scenario(true), selected);
  expect(probes.map(({ path, status }) => [path, status])).toEqual([
    [original, 200],
    [`/media/${mediaId}/w16`, 200],
    [optimizer, 200],
  ]);
  const imageHeaders = new Headers({ 'Content-Type': 'image/png' });
  const wrongBytes = Buffer.alloc(directBytes.byteLength, 0x20);
  expect(probes[0]!.matches(directBytes, imageHeaders)).toBe(true);
  expect(probes[0]!.matches(wrongBytes, imageHeaders)).toBe(false);
  expect(probes[0]!.matches(directBytes, new Headers({ 'Content-Type': 'image/webp' }))).toBe(
    false,
  );
  const webp = Buffer.from('52494646100000005745425056503820', 'hex');
  const optimizerHeaders = new Headers({ 'Content-Type': 'image/webp' });
  expect(probes[2]!.matches(webp, optimizerHeaders)).toBe(true);
  expect(probes[2]!.matches(Buffer.from('not an image'), optimizerHeaders)).toBe(false);
});

it('requires empty GET, HEAD and Range denials for each removed target after the final grant', () => {
  const probes = plan(scenario(false), selected);
  expect(probes.map(({ path, status, media }) => [path, status, media?.mode])).toEqual(
    [original, `/media/${mediaId}/w16`, optimizer].flatMap((path) =>
      ['get', 'head', 'range'].map((mode) => [path, 404, mode]),
    ),
  );
  const noStore = new Headers({ 'Cache-Control': 'private, no-store' });
  for (const probe of probes) {
    expect(probe.matches(Buffer.alloc(0), noStore)).toBe(true);
    expect(probe.matches(Buffer.from('leaked bytes'), noStore)).toBe(false);
    expect(
      probe.matches(
        Buffer.alloc(0),
        new Headers({ 'Cache-Control': 'private, no-store', 'Content-Range': 'bytes 0-1/8' }),
      ),
    ).toBe(false);
  }
});

it('uses the same first confirmed manifest as media delivery and handles a PDF without an optimizer target', () => {
  const pdf = {
    id: mediaId,
    manifest: {
      ...media.manifest,
      kind: 'pdf',
      original: { ...media.manifest.original, type: 'application/pdf' },
      variants: [],
    },
  };
  const root: PublicRoot = {
    generation: randomUUID(),
    subjects: { [other]: entry({ media: [pdf] }), [selected]: entry({ media: [media] }) },
  };
  const probes = plan(root, selected);
  expect(probes.map(({ path, status }) => [path, status])).toEqual([
    [original, 200],
    ...Array.from({ length: 3 }, () => [`/media/${mediaId}/w16`, 404]),
    ...Array.from({ length: 3 }, () => [optimizer, 404]),
  ]);
  expect(probes[0]!.matches(directBytes, new Headers({ 'Content-Type': 'application/pdf' }))).toBe(
    true,
  );
  expect(plan(root, other).map(({ path, status }) => [path, status])).toEqual([[original, 200]]);
});

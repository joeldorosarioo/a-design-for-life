import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { casePublicSnapshotSchema } from '@/features/cases/server/case-publication';
import { confirmedMedia } from '@/features/media-library/server';
import { getPublishedProfile, mapProfile } from '@/features/professional-profile/server';
import type { PublicationCoordinatorOptions } from '@/helpers/payload/publication-coordinator';
import {
  readPublicRoot,
  withPublicRootWriter,
  type PublicRoot,
} from '@/helpers/payload/public-root';
import type { PublicationUpdate } from '@/payload-types';
import { portfolioPublicationCoordinator } from './publication';

vi.mock('@/helpers/payload/publication-coordinator', () => ({
  createPublicationCoordinator: (options: PublicationCoordinatorOptions) => options,
}));

type Subject = PublicRoot['subjects'][string];
type Compose = (
  root: PublicRoot,
  operation: PublicationUpdate,
  previous: { previousAcknowledged: boolean },
) => Promise<PublicRoot>;

function entry(value: Subject['value']): Subject {
  return { operationId: randomUUID(), targetRevision: randomUUID(), value };
}

function image(id: string) {
  const object = { key: '1'.repeat(64), sha256: '2'.repeat(64), byteLength: 8 };
  return {
    id,
    manifest: {
      revision: randomUUID(),
      kind: 'image',
      original: { variant: 'original', type: 'image/png', object },
      variants: [{ variant: 'w16', type: 'image/webp', object }],
    },
  };
}

function scene(media: ReturnType<typeof image>[], removed: object[] = []) {
  const caseId = randomUUID();
  const contentId = randomUUID();
  const selected = `case-content/${contentId}`;
  const snapshot = {
    kind: 'case',
    caseId,
    contentId,
    locale: 'pt',
    slug: null,
    detail: null,
    media,
  };
  const predecessor = entry(z.json().parse({ ...snapshot, mediaObservation: { removed } }));
  const root: PublicRoot = {
    generation: randomUUID(),
    subjects: {
      [`cases/${caseId}`]: entry({ kind: 'case-order', caseId, sortOrder: 0, featured: false }),
      [selected]: predecessor,
    },
  };
  const operation: PublicationUpdate = {
    id: randomUUID(),
    operationId: randomUUID(),
    targetRevision: randomUUID(),
    subjectCollection: 'case-content',
    subjectId: contentId,
    target: { ...snapshot, media: [] },
    state: 'update-pending',
    attempts: 0,
    dependencies: ['media'],
    createdAt: '',
    updatedAt: '',
  };
  return { operation, root, selected };
}

function composition(directory: string, observed = true): Compose {
  const options = portfolioPublicationCoordinator(
    directory,
    observed
      ? { internalOrigin: 'http://127.0.0.1:3102', siteOrigin: 'https://portfolio.example.invalid' }
      : undefined,
  ) as unknown as PublicationCoordinatorOptions;
  return options.compose;
}

// The previous build's strict root decoder must accept the newly authored file.
const previousRootReader = z.strictObject({
  generation: z.uuid(),
  subjects: z.record(
    z.string(),
    z.strictObject({
      operationId: z.string().min(1),
      targetRevision: z.string().min(1),
      value: z.json(),
    }),
  ),
});

it('keeps removed image routes across a durable root reload without changing old readers or grants', async () => {
  const mediaId = randomUUID();
  const { operation, root, selected } = scene([image(mediaId)]);
  const directory = await mkdtemp(path.join(tmpdir(), 'publication-media-provenance-'));
  try {
    const next = await composition(directory)(root, operation, { previousAcknowledged: true });
    await withPublicRootWriter(directory, (_, commit) => commit(next));
    const reloaded = previousRootReader.parse(await readPublicRoot(directory));
    expect(reloaded.subjects[selected]?.value).toMatchObject({
      media: [],
      mediaObservation: {
        removed: [
          { mediaId, variant: 'original' },
          { mediaId, variant: 'w16' },
          { mediaId, optimizer: true },
        ],
      },
    });
    expect(casePublicSnapshotSchema.parse(reloaded.subjects[selected]?.value)).toMatchObject({
      media: [],
      detail: null,
    });
    expect(casePublicSnapshotSchema.parse(reloaded.subjects[selected]?.value)).not.toHaveProperty(
      'mediaObservation',
    );
    expect(confirmedMedia(reloaded)).toEqual([]);
    expect(JSON.stringify(reloaded)).not.toContain('1'.repeat(64));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('carries an unacknowledged predecessor removal and drops it when the predecessor was public', async () => {
  const lost = { mediaId: randomUUID(), variant: 'original' };
  const { operation, root, selected } = scene([], [lost]);
  const compose = composition('unused-by-pure-composition');
  const pending = await compose(root, operation, { previousAcknowledged: false });
  expect(pending.subjects[selected]?.value).toMatchObject({
    mediaObservation: { removed: [lost] },
  });
  const confirmed = await compose(root, operation, { previousAcknowledged: true });
  expect(confirmed.subjects[selected]?.value).toMatchObject({ mediaObservation: { removed: [] } });
  const disabled = await composition('unused-by-pure-composition', false)(root, operation, {
    previousAcknowledged: false,
  });
  expect(disabled.subjects[selected]?.value).not.toHaveProperty('mediaObservation');
});

it.each([
  { removed: [{ mediaId: randomUUID(), variant: 'original?redirect=external' }] },
  { removed: Array.from({ length: 65 }, () => ({ mediaId: randomUUID(), variant: 'original' })) },
])('rejects unsafe or oversized predecessor proof before composing', async ({ removed }) => {
  const { operation, root } = scene([], removed);
  await expect(
    composition('unused-by-pure-composition')(root, operation, { previousAcknowledged: false }),
  ).rejects.toThrow();
});

it('records a removed resume route without exposing the proof in the unchanged profile DTO', async () => {
  const { operation } = scene([]);
  const mediaId = randomUUID();
  const profileId = randomUUID();
  const profile = mapProfile({
    id: profileId,
    locale: 'pt',
    _status: 'published',
    identity: { name: 'Confirmed profile' },
    createdAt: '',
    updatedAt: '',
  });
  const target = z.json().parse({ kind: 'profile', locale: 'pt', profile, media: [] });
  const object = { key: '1'.repeat(64), sha256: '2'.repeat(64), byteLength: 8 };
  const resume = {
    id: mediaId,
    manifest: {
      revision: randomUUID(),
      kind: 'pdf',
      original: { variant: 'original', type: 'application/pdf', object },
      variants: [],
    },
  };
  const subject = `professional-profiles/${profileId}`;
  const root: PublicRoot = {
    generation: randomUUID(),
    subjects: {
      [subject]: entry(z.json().parse({ kind: 'profile', locale: 'pt', profile, media: [resume] })),
    },
  };
  const next = await composition('unused-by-pure-composition')(
    root,
    { ...operation, subjectCollection: 'professional-profiles', subjectId: profileId, target },
    { previousAcknowledged: true },
  );
  expect(next.subjects[subject]?.value).toMatchObject({
    mediaObservation: { removed: [{ mediaId, variant: 'original' }] },
  });
  expect(await getPublishedProfile('pt', undefined, previousRootReader.parse(next))).toEqual({
    ok: true,
    value: profile,
  });
});

it('does not replace a historical unacknowledged media root without removal provenance', async () => {
  const { operation, root, selected } = scene([image(randomUUID())]);
  const previous = root.subjects[selected]!;
  previous.value = z.json().parse(casePublicSnapshotSchema.parse(previous.value));
  expect(previous.value).not.toHaveProperty('mediaObservation');
  const compose = composition('unused-by-pure-composition');
  await expect(compose(root, operation, { previousAcknowledged: false })).rejects.toThrow(
    'Prior public media observation provenance unavailable.',
  );
  await expect(compose(root, operation, { previousAcknowledged: true })).resolves.toMatchObject({
    subjects: {
      [selected]: {
        operationId: operation.operationId,
        value: expect.objectContaining({ mediaObservation: { removed: expect.any(Array) } }),
      },
    },
  });
});

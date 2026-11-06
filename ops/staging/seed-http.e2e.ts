import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { createEditorialPayloadFixture } from '../../testing/fixtures/editorial-payload';
import {
  casePublicationFixture,
  navigationFixture,
  profilePublicationFixture,
} from '../../testing/fixtures/editorial-lifecycle';
import { assertIsolatedTestEnvironment } from '../../testing/setup/test-environment';
import { inspectOwnedTestDatabase } from '../../testing/setup/owned-test-database';
import { ensureProfileDrafts } from '../../src/features/professional-profile/server';
import { ensureNavigationDrafts } from '../../src/features/site-navigation/server';
import {
  NativeSeedClient,
  contentHash,
  createDemoPdf,
  newSeedState,
  seedStagingContent,
  sha256,
  type directLoopbackRequest,
  type stagingSeedSettings,
} from './seed-http.mjs';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

function imageReference(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(imageReference);
  if (!value || typeof value !== 'object') return value;
  const fields = value as Record<string, unknown>;
  if (fields.media) {
    const { media, ...metadata } = fields;
    return { $asset: media, ...metadata };
  }
  return Object.fromEntries(
    Object.entries(fields).map(([key, child]) => [key, imageReference(child)]),
  );
}

function syntheticPlan() {
  const documents: Array<{ key: string; collection: string; data: Record<string, unknown> }> = [
    { key: 'case01', collection: 'cases', data: { sortOrder: 1, featured: true } },
    { key: 'case02', collection: 'cases', data: { sortOrder: 2, featured: false } },
  ];
  for (const locale of ['pt', 'en']) {
    const profile = imageReference(
      profilePublicationFixture('portrait', 'unused-placeholder'),
    ) as Record<string, unknown>;
    documents.push({
      key: `profile:${locale}`,
      collection: 'professional-profiles',
      data: { ...profile, locale },
    });
    documents.push({
      key: `navigation:${locale}`,
      collection: 'site-navigation',
      data: { ...navigationFixture(), locale },
    });
    for (const key of ['case01', 'case02']) {
      const content = imageReference(
        casePublicationFixture(key === 'case01' ? 'project01-cover' : 'project02-cover'),
      ) as Record<string, unknown>;
      documents.push({
        key: `${key}:${locale}`,
        collection: 'case-content',
        data: { ...content, case: { $case: key }, locale },
      });
    }
  }
  return { documents };
}

async function syntheticAssets() {
  const images = await Promise.all(
    [
      'portrait',
      'project01-cover',
      'project02-cover',
      'editorial-desk',
      'editorial-architecture',
    ].map(async (role, index) => {
      const bytes = await sharp({
        create: {
          width: 32,
          height: 32,
          channels: 3,
          background: { r: 20 + index * 20, g: 60, b: 90 },
        },
      })
        .png()
        .toBuffer();
      return {
        role,
        bytes,
        sha256: sha256(bytes),
        type: 'image/png',
        name: `synthetic-${role}.png`,
      };
    }),
  );
  return [
    ...images,
    ...['pt', 'en'].map((locale) => {
      const bytes = createDemoPdf(locale);
      return {
        role: `resume-${locale}`,
        bytes,
        sha256: sha256(bytes),
        type: 'application/pdf',
        name: `synthetic-${locale}.pdf`,
      };
    }),
  ];
}

test('seeds a fresh owned target through Native HTTP, confirms ten routes and replays without content mutations', async ({}, info) => {
  test.setTimeout(180_000);
  if (info.config.workers !== 1 || info.config.fullyParallel)
    throw new Error('The Native seed proof requires its focused serial configuration.');
  assertIsolatedTestEnvironment(process.env);
  const owned = inspectOwnedTestDatabase();
  const fixture = await createEditorialPayloadFixture('staging-seed-native-http');
  const calls: Array<{ method: string; pathname: string }> = [];
  const target = process.env.SITE_ORIGIN!;
  const sourceEnvironment = { database: process.env.DATABASE_URI, origin: target };
  try {
    for (const collection of [
      'media',
      'cases',
      'case-content',
      'professional-profiles',
      'site-navigation',
    ] as const) {
      const found = await fixture.payload.find({
        collection,
        limit: 1,
        depth: 0,
        draft: true,
        overrideAccess: true,
      });
      expect(found.totalDocs, 'This dedicated proof must start with a fresh owned database.').toBe(
        0,
      );
    }
    await ensureProfileDrafts(await fixture.request());
    await ensureNavigationDrafts(await fixture.request());
    const baselines = new Map();
    for (const collection of ['professional-profiles', 'site-navigation'] as const) {
      const found = await fixture.payload.find({
        collection,
        limit: 3,
        depth: 0,
        draft: true,
        overrideAccess: true,
      });
      expect(found.docs).toHaveLength(2);
      for (const document of found.docs)
        baselines.set(`${collection}:${document.locale}`, {
          collection,
          locale: document.locale,
          id: document.id,
          updatedAt: document.updatedAt,
        });
    }
    const settings: ReturnType<typeof stagingSeedSettings> = {
      origin: target,
      database: 'adfl_test_runner',
      editorId: fixture.user.id,
      baselines,
      freshProvisioning: true,
      email: fixture.user.email,
      password: 'Synthetic-editorial-test-password-123!',
      scope: contentHash({ run: process.env.ADFL_TEST_RUN_ID, target, editor: fixture.user.id }),
    };
    // Only this source-owned test adapter changes the destination. The operator
    // CLI always uses its fixed loopback SSH forward and exact staging Origin.
    const send: typeof directLoopbackRequest = async (method, pathname, options = {}) => {
      assertIsolatedTestEnvironment(process.env);
      const current = inspectOwnedTestDatabase();
      if (
        current.containerId !== owned.containerId ||
        current.networkId !== owned.networkId ||
        process.env.DATABASE_URI !== sourceEnvironment.database ||
        process.env.SITE_ORIGIN !== sourceEnvironment.origin
      )
        throw new Error('Native seed proof lost its exact acquired test target.');
      calls.push({ method, pathname });
      const response = await fetch(`${target}${pathname}`, {
        method,
        headers: options.headers,
        ...(options.body ? { body: new Uint8Array(options.body) } : {}),
        redirect: 'error',
        credentials: 'omit',
        signal: AbortSignal.timeout(45_000),
      });
      const cookies = response.headers.getSetCookie();
      return {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          ...(cookies.length ? { 'set-cookie': cookies } : {}),
        },
        bytes: Buffer.from(await response.arrayBuffer()),
      };
    };
    const assets = await syntheticAssets();
    const state = newSeedState(settings);
    const plan = syntheticPlan();
    let checkpoints = 0;
    const save = async () => {
      checkpoints += 1;
    };
    const first = await seedStagingContent({
      settings,
      plan,
      assets,
      state,
      save,
      client: new NativeSeedClient(settings, send),
    });
    expect(first).toMatchObject({
      status: 'seeded',
      media: 7,
      caseIdentities: 2,
      documents: 8,
      publicRoutes: 10,
    });
    expect(checkpoints).toBeGreaterThan(20);
    const replayStart = calls.length;
    const replay = await seedStagingContent({
      settings,
      plan,
      assets,
      state,
      save,
      client: new NativeSeedClient(settings, send),
    });
    expect(replay).toEqual(first);
    const replayMutations = calls
      .slice(replayStart)
      .filter(
        (call) =>
          call.method !== 'GET' &&
          call.method !== 'OPTIONS' &&
          !['/api/users/login', '/api/users/logout'].includes(call.pathname),
      );
    expect(replayMutations).toEqual([]);
    expect(calls.filter((call) => /forgot|reset|invite|email/i.test(call.pathname))).toEqual([]);
    expect(calls.at(-1)).toEqual({ method: 'POST', pathname: '/api/users/logout' });
    const expectedCounts = {
      media: 7,
      cases: 2,
      'case-content': 4,
      'professional-profiles': 2,
      'site-navigation': 2,
    };
    for (const [collection, expected] of Object.entries(expectedCounts)) {
      const found = await fixture.payload.find({
        collection: collection as keyof typeof expectedCounts,
        limit: 1,
        depth: 0,
        draft: true,
        overrideAccess: true,
      });
      expect(found.totalDocs).toBe(expected);
    }
    await info.attach('staging-seed-native-http.json', {
      body: JSON.stringify({
        status: 'verified',
        first,
        replay,
        replayContentMutations: replayMutations.length,
        mailFlowCalls: 0,
        checkpoints,
        originalIntegrityVerified: true,
      }),
      contentType: 'application/json',
    });
  } finally {
    await fixture.payload.destroy();
  }
});

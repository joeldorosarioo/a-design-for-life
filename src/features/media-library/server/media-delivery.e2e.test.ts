import { confirmTestPublication } from '../../../../testing/fixtures/confirmed-publication';
import { createHash } from 'node:crypto';
import {
  apngUploadFixture,
  animatedAvifUploadFixture,
  animatedWebpUploadFixture,
} from '../../../../testing/fixtures/media-animation';
import { encryptedPdfUploadFixture } from '../../../../testing/fixtures/media-uploads';
import { sql } from '@payloadcms/db-postgres';
import path from 'node:path';
import { lstat, rename } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import { pdfUploadFixture } from '../../../../testing/fixtures/media-uploads';
import {
  casePublicationFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { mediaManifestSchema } from '../contracts/media-manifest.schema';
import type { Media } from '@/payload-types';

test.use({
  trace: 'off',
  screenshot: 'off',
  video: 'off',
  extraHTTPHeaders: { origin: process.env.SITE_ORIGIN! },
});
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
test.beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.6-native-http');
});
test.afterAll(async () => {
  await fixture?.payload.destroy();
});
async function login(request: import('@playwright/test').APIRequestContext) {
  const response = await request.post('/api/users/login', {
    data: { email: fixture.user.email, password: 'Synthetic-editorial-test-password-123!' },
  });
  expect(response.status()).toBe(200);
}

test('native production multipart decodes four static formats and PDF, then protects every byte path', async ({
  request,
  playwright,
}) => {
  await login(request);
  const anonymous = await playwright.request.newContext({
    baseURL: process.env.SITE_ORIGIN,
    extraHTTPHeaders: { origin: process.env.SITE_ORIGIN! },
  });
  try {
    for (const format of ['jpeg', 'png', 'webp', 'avif', 'pdf'] as const) {
      const bytes =
        format === 'pdf'
          ? Buffer.from(pdfUploadFixture())
          : await sharp({ create: { width: 80, height: 60, channels: 3, background: '#28506a' } })
              .toFormat(format)
              .toBuffer();
      const mimeType = format === 'pdf' ? 'application/pdf' : `image/${format}`;
      const created = await request.post('/api/media', {
        multipart: {
          _payload: JSON.stringify({ label: 'Synthetic native HTTP' }),
          file: { name: `synthetic.${format}`, mimeType, buffer: bytes },
        },
      });
      expect(created.status(), format).toBe(201);
      const body = await created.json();
      const doc = body.doc as Media;
      expect(doc.filesize).toBe(bytes.length);
      expect(doc.mimeType).toBe(mimeType);
      const raw = (await fixture.payload.db.findOne({
        collection: 'media',
        where: { id: { equals: doc.id } },
        req: await fixture.request(),
      })) as Media | null;
      const manifest = mediaManifestSchema.parse(raw?.manifest);
      expect(JSON.stringify(doc)).not.toContain(manifest.original.object.key);
      const preview = `/preview-media/${doc.id}/original`;
      const native = `/api/media/file/${doc.filename}`;
      const privateResponse = await request.get(preview);
      expect(privateResponse.status()).toBe(200);
      expect(privateResponse.headers()['cache-control']).toContain('private');
      expect(privateResponse.headers()['cache-control']).toContain('no-store');
      expect(await privateResponse.body()).toEqual(bytes);
      expect((await request.get(native)).status()).toBe(200);
      for (const path of [
        preview,
        native,
        `/media/${doc.id}/original`,
        ...(format === 'pdf' ? [] : [`/preview-media/${doc.id}/w80`, `/media/${doc.id}/w80`]),
      ]) {
        for (const method of ['GET', 'HEAD'] as const) {
          const denied = await anonymous.fetch(path, {
            method,
            headers: { 'if-none-match': '"synthetic"', range: 'bytes=0-10' },
          });
          expect([401, 403, 404]).toContain(denied.status());
          expect(denied.headers()['cache-control']).toContain('no-store');
        }
      }
      const optimizer = await anonymous.get(
        `/_next/image?url=${encodeURIComponent(preview)}&w=640&q=75`,
      );
      expect([400, 404]).toContain(optimizer.status());
    }
  } finally {
    await anonymous.dispose();
  }
});

test('approved public original and derivative revoke immediately after withdrawal including HEAD and conditionals', async ({
  request,
  playwright,
}) => {
  await login(request);
  const bytes = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#28506a' },
  })
    .png()
    .toBuffer();
  const uploaded = await request.post('/api/media', {
    multipart: {
      _payload: '{}',
      file: { name: 'synthetic.png', mimeType: 'image/png', buffer: bytes },
    },
  });
  expect(uploaded.status()).toBe(201);
  const media = (await uploaded.json()).doc as Media;
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic HTTP approval' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const content = await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: shared.id,
      locale: 'pt',
      ...casePublicationFixture(media.id),
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(content, await fixture.request());
  const anonymous = await playwright.request.newContext({ baseURL: process.env.SITE_ORIGIN });
  try {
    for (const variant of ['original', 'w80']) {
      const response = await anonymous.get(`/media/${media.id}/${variant}`);
      expect(response.status()).toBe(200);
      expect(response.headers()['cache-control']).toContain('no-store');
    }
    const withdrawn = await fixture.payload.update({
      collection: 'case-content',
      id: content.id,
      data: { _status: 'draft' },
      req: await observedRequest('case-content', content.id, await fixture.request()),
      overrideAccess: false,
    });
    await confirmTestPublication(withdrawn, await fixture.request());
    for (const variant of ['original', 'w80'])
      for (const method of ['GET', 'HEAD'] as const) {
        const response = await anonymous.fetch(`/media/${media.id}/${variant}`, {
          method,
          headers: { 'if-none-match': '"synthetic"' },
        });
        expect(response.status()).toBe(404);
        expect(response.headers()['cache-control']).toContain('no-store');
      }
  } finally {
    await anonymous.dispose();
  }
});

test('native media UI creates an immutable asset and shows its private thumbnail after reload', async ({
  page,
}) => {
  await login(page.request);
  await page.goto('/admin/collections/media/create');
  await expect(page.getByRole('button', { name: 'Select a file', exact: true })).toBeVisible();
  const bytes = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#28506a' },
  })
    .png()
    .toBuffer();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'synthetic-ui.png', mimeType: 'image/png', buffer: bytes });
  await page.getByLabel('Identificação interna', { exact: true }).fill('Synthetic native media UI');
  const created = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/media' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const doc = (await response.json()).doc as Media;
  expect(doc.label).toBe('Synthetic native media UI');
  await expect(page).toHaveURL(new RegExp('/admin/collections/media/' + doc.id + '(?:[?].*)?$'));
  await page.reload();
  await expect(page.getByLabel('Identificação interna', { exact: true })).toHaveValue(
    'Synthetic native media UI',
  );
  const thumbnail = await page.request.get(`/preview-media/${doc.id}/w80`);
  expect(thumbnail.status()).toBe(200);
  await page.screenshot({
    path: 'docs/verification/artifacts/E1.6/native-media-ui.png',
    fullPage: true,
  });
});

test('real storage loss stays503 while SQL loss preserves confirmed public bytes and returns503 for private or uncached paths', async ({
  request,
  playwright,
}) => {
  await login(request);
  const bytes = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#28506a' },
  })
    .png()
    .toBuffer();
  const uploaded = await request.post('/api/media', {
    multipart: {
      _payload: '{}',
      file: { name: 'synthetic-fault.png', mimeType: 'image/png', buffer: bytes },
    },
  });
  expect(uploaded.status()).toBe(201);
  const media = (await uploaded.json()).doc as Media;
  const shared = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic dependency failure' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const approved = await fixture.payload.create({
    collection: 'case-content',
    data: {
      case: shared.id,
      locale: 'pt',
      ...casePublicationFixture(media.id),
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(approved, await fixture.request());
  const anonymous = await playwright.request.newContext({ baseURL: process.env.SITE_ORIGIN });
  try {
    const paths = [
      { client: request, url: `/preview-media/${media.id}/original` },
      { client: request, url: `/api/media/file/${media.filename}` },
      { client: anonymous, url: `/media/${media.id}/original` },
      { client: request, url: `/preview-media/${media.id}/w80` },
      { client: anonymous, url: `/media/${media.id}/w80` },
    ];
    const baseline = new Map<string, Buffer>();
    for (const entry of paths) {
      const response = await entry.client.get(entry.url);
      expect(response.status()).toBe(200);
      baseline.set(entry.url, await response.body());
      const head = await entry.client.head(entry.url);
      expect(head.status(), entry.url).toBe(entry.url.startsWith('/api/media/file/') ? 404 : 200);
      expect(head.headers()['cache-control']).toContain('no-store');
      expect((await head.body()).length).toBe(0);
    }
    const raw = (await fixture.payload.db.findOne({
      collection: 'media',
      where: { id: { equals: media.id } },
      req: await fixture.request(),
    })) as Media | null;
    const manifest = mediaManifestSchema.parse(raw?.manifest);
    const database = new URL(process.env.DATABASE_URI!);
    if (
      process.env.APP_ENV !== 'test' ||
      database.port !== '55433' ||
      !/^\/adfl_test_[a-z0-9_]+$/.test(database.pathname)
    )
      throw new Error('Fault injection requires owned isolated test resources');
    const root = path.resolve(
      process.env.MEDIA_STORAGE_ROOT ??
        path.join('.work/private-media', process.env.MEDIA_BUCKET!, database.pathname.slice(1)),
    );
    const objectPath = path.resolve(root, manifest.original.object.key);
    const unavailable = objectPath + '.e1-6-unavailable';
    if (path.dirname(objectPath) !== root || path.dirname(unavailable) !== root)
      throw new Error('Object fault target must stay inside its owned test storage root');
    await lstat(unavailable).then(
      () => {
        throw new Error('Preserve existing fault backup');
      },
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      },
    );
    const assertUnavailable = async (entries: typeof paths) => {
      for (const entry of entries)
        for (const method of ['GET', 'HEAD'] as const) {
          const response = await entry.client.fetch(entry.url, {
            method,
            headers: {
              'If-None-Match': '*',
              'If-Modified-Since': 'Thu, 01 Jan 2099 00:00:00 GMT',
              Range: 'bytes=0-10',
            },
          });
          const unsupportedNativeHead =
            method === 'HEAD' && entry.url.startsWith('/api/media/file/');
          expect(response.status(), entry.url).toBe(unsupportedNativeHead ? 404 : 503);
          expect(response.headers()['cache-control']).toContain('no-store');
          if (!unsupportedNativeHead)
            expect(response.headers()['x-robots-tag']).toContain('noindex');
          expect((await response.body()).length).toBe(0);
        }
    };
    await rename(objectPath, unavailable);
    try {
      await assertUnavailable(paths.slice(0, 3));
    } finally {
      await rename(unavailable, objectPath);
    }
    for (const entry of paths) {
      const response = await entry.client.get(entry.url);
      expect(response.status()).toBe(200);
      expect(await response.body()).toEqual(baseline.get(entry.url));
      const head = await entry.client.head(entry.url);
      expect(head.status(), entry.url).toBe(entry.url.startsWith('/api/media/file/') ? 404 : 200);
      expect(head.headers()['cache-control']).toContain('no-store');
      expect((await head.body()).length).toBe(0);
    }
    const unknownMedia = crypto.randomUUID();
    const unknownPublic = ['original', 'w80'].map((variant) => ({
      client: anonymous,
      url: `/media/${unknownMedia}/${variant}`,
    }));
    for (const entry of unknownPublic)
      expect((await entry.client.get(entry.url)).status()).toBe(404);
    await fixture.payload.db.execute({
      db: fixture.payload.db.drizzle,
      sql: sql`ALTER TABLE "media" RENAME TO "e1_6_unavailable_media"`,
    });
    try {
      await assertUnavailable([
        ...paths.filter((entry) => !entry.url.startsWith('/media/')),
        ...unknownPublic,
      ]);
      for (const entry of paths.filter((entry) => entry.url.startsWith('/media/'))) {
        for (const method of ['GET', 'HEAD'] as const) {
          const response = await entry.client.fetch(entry.url, {
            method,
            headers: { 'If-None-Match': '*', Range: 'bytes=0-10' },
          });
          expect(response.status(), entry.url).toBe(200);
          expect(response.headers()['cache-control']).toContain('no-store');
          expect(await response.body()).toEqual(
            method === 'HEAD' ? Buffer.alloc(0) : baseline.get(entry.url),
          );
        }
      }
    } finally {
      await fixture.payload.db.execute({
        db: fixture.payload.db.drizzle,
        sql: sql`ALTER TABLE "e1_6_unavailable_media" RENAME TO "media"`,
      });
    }
    for (const entry of paths) {
      const response = await entry.client.get(entry.url);
      expect(response.status()).toBe(200);
      expect(await response.body()).toEqual(baseline.get(entry.url));
      const head = await entry.client.head(entry.url);
      expect(head.status(), entry.url).toBe(entry.url.startsWith('/api/media/file/') ? 404 : 200);
      expect(head.headers()['cache-control']).toContain('no-store');
      expect((await head.body()).length).toBe(0);
    }
    for (const entry of unknownPublic)
      expect((await entry.client.get(entry.url)).status()).toBe(404);
    console.info(
      'Storage missing503; SQL outage preserves confirmed public bytes200, private503, unknown public404→503→404; native HEAD remains404/no-store',
    );
  } finally {
    await anonymous.dispose();
  }
});

test('native HTTP applies approved animation/password policy and rejects disguised, corrupt, and oversized uploads', async ({
  request,
}) => {
  await login(request);
  const before = await fixture.payload.count({
    collection: 'media',
    req: await fixture.request(),
    overrideAccess: false,
  });
  const image = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#28506a' },
  })
    .png()
    .toBuffer();
  const imageTooLarge = Buffer.alloc(10_000_001);
  image.copy(imageTooLarge);
  const pdfTooLarge = Buffer.alloc(5_000_001, 32);
  Buffer.from(pdfUploadFixture()).copy(pdfTooLarge);
  const rejected = [
    {
      name: 'disguised-svg.png',
      type: 'image/png',
      bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      statuses: [400],
    },
    {
      name: 'fabricated.pdf',
      type: 'application/pdf',
      bytes: Buffer.from('%PDF-1.7\nxref\n%%EOF'),
      statuses: [400],
    },
    {
      name: 'corrupt.png',
      type: 'image/png',
      bytes: image.subarray(0, image.length - 20),
      statuses: [400],
    },
    {
      name: 'animated.png',
      type: 'image/png',
      bytes: Buffer.from(await apngUploadFixture()),
      statuses: [400],
    },
    {
      name: 'hidden-default.png',
      type: 'image/png',
      bytes: Buffer.from(await apngUploadFixture({ hiddenDefault: true })),
      statuses: [400],
    },
    {
      name: 'animated.avif',
      type: 'image/avif',
      bytes: Buffer.from(await animatedAvifUploadFixture()),
      statuses: [400],
    },
    {
      name: 'opening-password.pdf',
      type: 'application/pdf',
      bytes: Buffer.from(await encryptedPdfUploadFixture('synthetic-opening-password')),
      statuses: [400],
    },
    { name: 'too-large.png', type: 'image/png', bytes: imageTooLarge, statuses: [400, 413] },
    { name: 'too-large.pdf', type: 'application/pdf', bytes: pdfTooLarge, statuses: [400] },
  ];
  for (const control of rejected) {
    const response = await request.post('/api/media', {
      multipart: {
        _payload: '{}',
        file: { name: control.name, mimeType: control.type, buffer: control.bytes },
      },
    });
    expect(control.statuses, control.name).toContain(response.status());
  }
  expect(
    (
      await fixture.payload.count({
        collection: 'media',
        req: await fixture.request(),
        overrideAccess: false,
      })
    ).totalDocs,
  ).toBe(before.totalDocs);
  const encrypted = Buffer.from(await encryptedPdfUploadFixture(''));
  const accepted = await request.post('/api/media', {
    multipart: {
      _payload: '{}',
      file: { name: 'permissions-encrypted.pdf', mimeType: 'application/pdf', buffer: encrypted },
    },
  });
  expect(accepted.status()).toBe(201);
  const doc = (await accepted.json()).doc as Media;
  const preview = await request.get(`/preview-media/${doc.id}/original`);
  expect(preview.status()).toBe(200);
  expect(await preview.body()).toEqual(encrypted);
});

test('native animated WebP keeps every frame, timing, loop and responsive dimensions in private and approved delivery', async ({
  request,
  playwright,
}) => {
  await login(request);
  const bytes = Buffer.from(await animatedWebpUploadFixture());
  const uploaded = await request.post('/api/media', {
    multipart: {
      _payload: '{}',
      file: { name: 'synthetic-animated.webp', mimeType: 'image/webp', buffer: bytes },
    },
  });
  expect(uploaded.status()).toBe(201);
  const media = (await uploaded.json()).doc as Media;
  expect(media.width).toBe(370);
  expect(media.height).toBe(285);
  const anonymous = await playwright.request.newContext({ baseURL: process.env.SITE_ORIGIN });
  try {
    for (const [variant, width, height] of [
      ['original', 370, 285],
      ['w342', 342, 263],
      ['w370', 370, 285],
    ] as const) {
      expect((await anonymous.get(`/media/${media.id}/${variant}`)).status()).toBe(404);
      const preview = await request.get(`/preview-media/${media.id}/${variant}`);
      expect(preview.status()).toBe(200);
      const body = await preview.body();
      if (variant === 'original') expect(body).toEqual(bytes);
      const metadata = await sharp(body, { animated: true }).metadata();
      expect(metadata).toMatchObject({
        format: 'webp',
        width,
        height: height * 3,
        pageHeight: height,
        pages: 3,
        delay: [100, 200, 300],
        loop: 3,
      });
      const decoded = await sharp(body, { animated: true })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const frameLength = width * height * decoded.info.channels;
      const frames = [0, 1, 2].map((index) =>
        createHash('sha256')
          .update(decoded.data.subarray(index * frameLength, (index + 1) * frameLength))
          .digest('hex'),
      );
      expect(new Set(frames).size).toBe(3);
    }
    expect(await (await request.get(`/api/media/file/${media.filename}`)).body()).toEqual(bytes);
    const shared = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Synthetic animated WebP' },
      req: await fixture.request(),
      overrideAccess: false,
    });
    const approved = await fixture.payload.create({
      collection: 'case-content',
      data: {
        case: shared.id,
        locale: 'pt',
        ...casePublicationFixture(media.id),
        _status: 'published',
      },
      req: await fixture.request(),
      overrideAccess: false,
    });
    await confirmTestPublication(approved, await fixture.request());
    for (const variant of ['original', 'w342', 'w370']) {
      const response = await anonymous.get(`/media/${media.id}/${variant}`);
      expect(response.status()).toBe(200);
      expect(await sharp(await response.body(), { animated: true }).metadata()).toMatchObject({
        pages: 3,
        delay: [100, 200, 300],
        loop: 3,
      });
    }
  } finally {
    await anonymous.dispose();
  }
});

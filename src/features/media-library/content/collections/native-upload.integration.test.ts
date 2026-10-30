import { mediaRuntime } from '../../server/media-runtime';
import { ProcessingGate } from '../../server/processing-gate';
import sharp from 'sharp';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { createLocalReq } from 'payload';
import { createEditorialPayloadFixture } from '../../../../../testing/fixtures/editorial-payload';
import { pdfUploadFixture } from '../../../../../testing/fixtures/media-uploads';
import { mediaManifestSchema } from '../../contracts/media-manifest.schema';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.6-native-common-intake');
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
async function upload(bytes: Buffer, type: string, name: string) {
  return fixture.payload.create({
    collection: 'media',
    data: {},
    file: { data: bytes, size: 1, name, mimetype: type },
    req: await fixture.request(),
    overrideAccess: false,
  });
}
it.each(['jpeg', 'png', 'webp', 'avif'] as const)(
  'accepts a genuine static %s through native Local upload and stores real immutable bytes',
  async (format) => {
    const bytes = await sharp({
      create: { width: 80, height: 60, channels: 3, background: '#28506a' },
    })
      .toFormat(format)
      .toBuffer();
    const doc = await upload(bytes, `image/${format}`, `synthetic.${format}`);
    expect(doc).toMatchObject({
      filesize: bytes.length,
      mimeType: `image/${format}`,
      width: 80,
      height: 60,
    });
    expect(doc.thumbnailURL).toBe(`/preview-media/${doc.id}/w80`);
    const raw = await fixture.payload.db.findOne({
      collection: 'media',
      req: await fixture.request(),
      where: { id: { equals: doc.id } },
    });
    const manifest = mediaManifestSchema.parse(
      (raw as unknown as Record<string, unknown>)?.manifest,
    );
    expect(manifest.original.object.byteLength).toBe(bytes.length);
    expect(manifest.variants.map((v) => [v.width, v.height])).toEqual([[80, 60]]);
    expect(JSON.stringify(doc)).not.toContain(manifest.original.object.key);
    await expect(
      fixture.payload.update({
        collection: 'media',
        id: doc.id,
        data: {},
        file: { data: bytes, size: bytes.length, name: 'replacement.png', mimetype: 'image/png' },
        req: await fixture.request(),
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 400 });
  },
);
it('accepts an actual PDF through native upload', async () => {
  const bytes = Buffer.from(pdfUploadFixture());
  const doc = await upload(bytes, 'application/pdf', 'synthetic.pdf');
  expect(doc).toMatchObject({ mimeType: 'application/pdf', filesize: bytes.length });
});
it('authenticates before heavy decode even with Local overrideAccess', async () => {
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#28506a' } })
    .png()
    .toBuffer();
  const spy = vi.spyOn(sharp.prototype, 'stats');
  try {
    await expect(
      fixture.payload.create({
        collection: 'media',
        data: {},
        file: { data: bytes, size: bytes.length, name: 'synthetic.png', mimetype: 'image/png' },
        req: await createLocalReq({}, fixture.payload),
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});
it('rejects fake bytes and unsupported native reprocessing paths with an authenticated editor', async () => {
  await expect(
    upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/png', 'synthetic.png'),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    fixture.payload.create({
      collection: 'media',
      data: {},
      req: await fixture.request(),
      overrideAccess: true,
    }),
  ).rejects.toMatchObject({ status: 400 });
});

function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
it('holds one full native job through real storage, bounds its queue, and recovers after error', async () => {
  const bytes = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#28506a' },
  })
    .png()
    .toBuffer();
  const storage = mediaRuntime().storage;
  const originalPut = storage.put.bind(storage);
  const entered = barrier(),
    queued = barrier(),
    release = barrier();
  let writes = 0,
    attempts = 0;
  const storageObserver = vi.spyOn(storage, 'put').mockImplementation(async (value) => {
    writes++;
    if (writes === 1) {
      entered.resolve();
      await release.promise;
    }
    return originalPut(value);
  });
  const realRun = ProcessingGate.prototype.run;
  const admissionObserver = vi.spyOn(ProcessingGate.prototype, 'run').mockImplementation(function <
    T,
  >(this: ProcessingGate, operation: () => Promise<T>): Promise<T> {
    attempts++;
    const pending = realRun.call(this, operation) as Promise<T>;
    if (attempts === 2) queued.resolve();
    return pending;
  });
  const decode = vi.spyOn(sharp.prototype, 'stats');
  const jobs: Array<Promise<unknown>> = [];
  try {
    const first = upload(bytes, 'image/png', 'first.png').then(
      (doc) => ({ ok: true, id: doc.id }),
      () => ({ ok: false, id: null }),
    );
    jobs.push(first);
    await entered.promise;
    const second = upload(bytes, 'image/png', 'second.png').then(
      (doc) => ({ ok: true, id: doc.id }),
      () => ({ ok: false, id: null }),
    );
    jobs.push(second);
    await queued.promise;
    const excess = await upload(bytes, 'image/png', 'third.png').then(
      () => ({ status: 200 }),
      (error: unknown) => error,
    );
    expect(excess).toMatchObject({ status: 503 });
    expect(decode).toHaveBeenCalledTimes(1);
    release.resolve();
    const results = await Promise.all([first, second]);
    expect(results.map((result) => result.ok)).toEqual([true, true]);
    expect(results[0].id).not.toBe(results[1].id);
  } finally {
    release.resolve();
    await Promise.allSettled(jobs);
    storageObserver.mockRestore();
    admissionObserver.mockRestore();
    decode.mockRestore();
  }
});
it('does not run a second native encode for WebP', async () => {
  const bytes = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#28506a' },
  })
    .webp()
    .toBuffer();
  const encoder = vi.spyOn(sharp.prototype, 'toBuffer');
  try {
    await upload(bytes, 'image/webp', 'single-encode.webp');
    expect(encoder).toHaveBeenCalledTimes(1);
  } finally {
    encoder.mockRestore();
  }
});
it('keeps technical fields server-owned and prevents duplicate/crop/url-only bypasses', async () => {
  const bytes = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#28506a' },
  })
    .png()
    .toBuffer();
  for (const data of [
    { manifest: {} },
    { usages: [] },
    { guardRevision: crypto.randomUUID() },
    { uploadEdits: { crop: { x: 0, y: 0, width: 1, height: 1 } } },
  ]) {
    await expect(
      fixture.payload.create({
        collection: 'media',
        data,
        file: { data: bytes, size: bytes.length, name: 'synthetic.png', mimetype: 'image/png' },
        req: await fixture.request(),
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 400 });
  }
  const doc = await upload(bytes, 'image/png', 'source.png');
  await expect(
    fixture.payload.create({
      collection: 'media',
      duplicateFromID: doc.id,
      data: {},
      file: { data: bytes, size: bytes.length, name: 'synthetic.png', mimetype: 'image/png' },
      req: await fixture.request(),
      overrideAccess: true,
    }),
  ).rejects.toMatchObject({ status: 400 });
  const fetch = vi.spyOn(globalThis, 'fetch');
  try {
    await expect(
      fixture.payload.create({
        collection: 'media',
        data: { filename: 'remote.png', url: 'https://example.invalid/private.png' },
        req: await fixture.request(),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    fetch.mockRestore();
  }
});
it('does not persist partial media on storage failure or leak storage diagnostics and releases the native slot', async () => {
  const bytes = await sharp({
    create: { width: 1000, height: 500, channels: 3, background: '#28506a' },
  })
    .png()
    .toBuffer();
  const before = await fixture.payload.count({
    collection: 'media',
    req: await fixture.request(),
    overrideAccess: false,
  });
  const storage = mediaRuntime().storage;
  const original = storage.put.bind(storage);
  let writes = 0;
  const spy = vi.spyOn(storage, 'put').mockImplementation(async (value) => {
    writes++;
    if (writes === 3) throw new Error('synthetic private storage path must not escape');
    return original(value);
  });
  try {
    await expect(upload(bytes, 'image/png', 'failed.png')).rejects.toMatchObject({
      status: 503,
      message: expect.not.stringContaining('private storage path'),
    });
  } finally {
    spy.mockRestore();
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
  expect((await upload(bytes, 'image/png', 'retry.png')).id).toBeTruthy();
});

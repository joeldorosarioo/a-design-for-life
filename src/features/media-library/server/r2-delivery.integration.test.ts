import { once } from 'node:events';
import { createServer } from 'node:http';
import { createLocalReq } from 'payload';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { confirmTestPublication } from '../../../../testing/fixtures/confirmed-publication';
import {
  casePublicationFixture,
  observedRequest,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import { createR2ObjectStorage } from '@/helpers/storage/r2-storage';
import { installMediaRuntime, mediaRuntime } from './media-runtime';
import { resolveMediaAccess } from './resolve-media-access';

it('rejects incomplete remote uploads and delivers only editorially authorized remote bytes', async () => {
  const fixture = await createEditorialPayloadFixture('e3-private-s3-delivery');
  const previous = mediaRuntime();
  const bucket = 'synthetic-private-media';
  const accepted = new Map<string, { bytes: Buffer; sha256: string }>();
  const received: string[] = [];
  let failOnThirdPut = true;
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    const key = path.slice(bucket.length + 2);
    if (
      !path.startsWith('/' + bucket + '/') ||
      !/^[a-f0-9]{64}$/.test(key) ||
      !request.headers.authorization?.startsWith('AWS4-HMAC-SHA256 ')
    ) {
      response.writeHead(403).end();
      return;
    }
    if (request.method === 'PUT') {
      if (request.headers['if-none-match'] !== '*' || accepted.has(key)) {
        response.writeHead(412).end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      received.push(key);
      if (failOnThirdPut && received.length === 3) {
        request.socket.destroy();
        return;
      }
      accepted.set(key, {
        bytes: Buffer.concat(chunks),
        sha256: String(request.headers['x-amz-meta-sha256']),
      });
      response.writeHead(200).end();
      return;
    }
    const object = accepted.get(key);
    if (request.method !== 'GET' || !object) {
      response.writeHead(404).end();
      return;
    }
    response
      .writeHead(200, {
        'content-length': object.bytes.length,
        'x-amz-meta-sha256': object.sha256,
      })
      .end(object.bytes);
  });

  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Synthetic S3 listener unavailable.');
    installMediaRuntime({
      storage: createR2ObjectStorage({
        endpoint: 'http://127.0.0.1:' + address.port,
        bucket,
        accessKeyId: 'synthetic-s3-access',
        secretAccessKey: 'synthetic-s3-secret',
      }),
      checkerBinary: previous.checkerBinary,
    });

    const bytes = await sharp({
      create: { width: 1000, height: 500, channels: 3, background: '#28506a' },
    })
      .png()
      .toBuffer();
    const upload = async () =>
      fixture.payload.create({
        collection: 'media',
        data: {},
        file: { data: bytes, size: bytes.length, name: 'synthetic.png', mimetype: 'image/png' },
        req: await fixture.request(),
        overrideAccess: false,
      });
    const countMedia = async () =>
      fixture.payload.count({
        collection: 'media',
        req: await fixture.request(),
        overrideAccess: false,
      });

    const before = await countMedia();
    await expect(upload()).rejects.toMatchObject({ status: 503 });
    expect(received).toHaveLength(3);
    expect(accepted.size).toBe(2);
    expect(await countMedia()).toEqual(before);

    failOnThirdPut = false;
    const media = await upload();
    expect((await countMedia()).totalDocs).toBe(before.totalDocs + 1);
    const anonymous = await createLocalReq({}, fixture.payload);
    const deliver = (variant: 'original' | 'w640') =>
      resolveMediaAccess({ mediaId: media.id, preview: false, variant }, anonymous);
    expect(await deliver('original')).toEqual({ ok: false, status: 404 });
    expect(await deliver('w640')).toEqual({ ok: false, status: 404 });
    const preview = await resolveMediaAccess(
      { mediaId: media.id, preview: true, variant: 'original' },
      await fixture.request(),
    );
    expect(preview).toEqual({
      ok: true,
      value: { bytes: new Uint8Array(bytes), type: 'image/png' },
    });

    const owner = await fixture.payload.create({
      collection: 'cases',
      data: { internalTitle: 'Synthetic S3 delivery' },
      req: await fixture.request(),
      overrideAccess: false,
    });
    const published = await fixture.payload.create({
      collection: 'case-content',
      data: {
        case: owner.id,
        locale: 'pt',
        ...casePublicationFixture(media.id),
        _status: 'published',
      },
      req: await fixture.request(),
      overrideAccess: false,
    });
    await confirmTestPublication(published, await fixture.request());
    expect(await deliver('original')).toEqual(preview);
    const derivative = await deliver('w640');
    expect(derivative.ok).toBe(true);
    if (!derivative.ok) throw new Error('Published derivative was unavailable.');
    expect(await sharp(derivative.value.bytes).metadata()).toMatchObject({
      width: 640,
      height: 320,
    });

    const withdrawn = await fixture.payload.update({
      collection: 'case-content',
      id: published.id,
      data: { _status: 'draft' },
      req: await observedRequest('case-content', published.id, await fixture.request()),
      overrideAccess: false,
    });
    await confirmTestPublication(withdrawn, await fixture.request());
    expect(await deliver('original')).toEqual({ ok: false, status: 404 });
    expect(await deliver('w640')).toEqual({ ok: false, status: 404 });
    expect(new Set(received).size).toBe(received.length);
  } finally {
    installMediaRuntime(previous);
    if (server.listening) {
      const closed = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await closed;
    }
    await fixture.payload.destroy();
  }
});

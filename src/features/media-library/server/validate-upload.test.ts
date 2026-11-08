import sharp from 'sharp';
import { expect, it } from 'vitest';
import {
  mediaCheckerFixturePath,
  pdfUploadFixture,
  encryptedPdfUploadFixture,
} from '../../../../testing/fixtures/media-uploads';
import {
  animatedAvifUploadFixture,
  animatedWebpUploadFixture,
  apngUploadFixture,
} from '../../../../testing/fixtures/media-animation';
import { validateUpload } from './validate-upload';
const options = { checkerBinary: mediaCheckerFixturePath() };
const file = (bytes: Uint8Array) => ({ bytes, name: 'synthetic.png', declaredType: 'image/png' });
it.each(['jpeg', 'png', 'webp', 'avif'] as const)(
  'fully decodes genuine static %s and uses its actual type',
  async (format) => {
    const bytes = await sharp({
      create: { width: 80, height: 60, channels: 3, background: '#28506a' },
    })
      .toFormat(format)
      .toBuffer();
    const result = await validateUpload(file(bytes), options);
    expect(result).toMatchObject({
      ok: true,
      value: {
        kind: 'image',
        type: `image/${format}`,
        width: 80,
        height: 60,
        byteLength: bytes.length,
      },
    });
  },
);
it('accounts for EXIF orientation before deriving consumption dimensions', async () => {
  const bytes = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#28506a' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  expect(await validateUpload(file(bytes), options)).toMatchObject({
    ok: true,
    value: { width: 60, height: 80 },
  });
});
it('rejects damaged pixels even when metadata can read image dimensions', async () => {
  const original = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#28506a' },
  })
    .png()
    .toBuffer();
  const bytes = original.subarray(0, original.length - 20);
  expect(await sharp(bytes).metadata()).toMatchObject({ width: 80, height: 60 });
  expect(await validateUpload(file(bytes), options)).toMatchObject({
    ok: false,
    error: { code: 'invalid-input' },
  });
});
it('accepts actual PDF bytes and rejects fabricated and corrupt-stream PDFs', async () => {
  expect(await validateUpload(file(pdfUploadFixture()), options)).toMatchObject({
    ok: true,
    value: { kind: 'pdf', type: 'application/pdf', pages: 3 },
  });
  expect(
    await validateUpload(file(pdfUploadFixture({ brokenStream: true })), options),
  ).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
  expect(
    await validateUpload(file(new TextEncoder().encode('%PDF-1.7\nxref\n%%EOF')), options),
  ).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
});
it('rejects a PDF requiring an opening password and accepts permission-only encryption', async () => {
  expect(await validateUpload(file(await encryptedPdfUploadFixture('')), options)).toMatchObject({
    ok: true,
    value: { kind: 'pdf', pages: 3 },
  });
  expect(
    await validateUpload(file(await encryptedPdfUploadFixture('synthetic')), options),
  ).toMatchObject({
    ok: false,
    error: { code: 'invalid-input', message: expect.stringMatching(/senha/i) },
  });
});

it('accepts every genuine animated WebP frame with per-frame dimensions and unchanged original bytes', async () => {
  const bytes = await animatedWebpUploadFixture();
  const result = await validateUpload(file(bytes), options);
  expect(result).toMatchObject({
    ok: true,
    value: {
      kind: 'image',
      type: 'image/webp',
      width: 370,
      height: 285,
      byteLength: bytes.length,
      animation: { pages: 3, delay: [100, 200, 300], loop: 3 },
    },
  });
  if (result.ok) expect(result.value.bytes).toEqual(new Uint8Array(bytes));
});

it('uses the oriented dimensions of one animated frame instead of the stacked strip', async () => {
  const bytes = await animatedWebpUploadFixture({ orientation: 6 });
  expect(await validateUpload(file(bytes), options)).toMatchObject({
    ok: true,
    value: { width: 285, height: 370, animation: { pages: 3 } },
  });
});

it.each([false, true])(
  'rejects genuine APNG including hidden fallback=%s',
  async (hiddenDefault) => {
    const bytes = apngUploadFixture({ hiddenDefault });
    const decoded = await sharp(bytes).raw().toBuffer();
    if (hiddenDefault) expect(Array.from(decoded.subarray(0, 4))).toEqual([255, 255, 255, 255]);
    expect(await sharp(bytes).metadata()).toMatchObject(
      hiddenDefault ? { width: 4, height: 4 } : { width: 85, height: 77 },
    );
    expect(await validateUpload(file(bytes), options)).toMatchObject({
      ok: false,
      error: { code: 'invalid-input', message: expect.stringMatching(/APNG/i) },
    });
  },
);

it('rejects the genuine animated AVIF sequence explicitly', async () => {
  expect(await validateUpload(file(await animatedAvifUploadFixture()), options)).toMatchObject({
    ok: false,
    error: { code: 'invalid-input', message: expect.stringMatching(/AVIF.*animad/i) },
  });
});

it('rejects corruption in a later WebP frame even when metadata and the first frame decode', async () => {
  const bytes = Buffer.from(await animatedWebpUploadFixture({ width: 80, height: 60 }));
  let lastFrame = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset + 4);
    if (bytes.toString('ascii', offset, offset + 4) === 'ANMF') lastFrame = offset;
    offset += 8 + length + (length % 2);
  }
  const frameEnd = lastFrame + 8 + bytes.readUInt32LE(lastFrame + 4);
  bytes.fill(255, lastFrame + 8 + 16 + 8 + 5, frameEnd);
  expect(await sharp(bytes, { animated: true }).metadata()).toMatchObject({ pages: 3 });
  await expect(sharp(bytes).stats()).resolves.toMatchObject({ isOpaque: true });
  expect(await validateUpload(file(bytes), options)).toMatchObject({
    ok: false,
    error: { code: 'invalid-input' },
  });
});

import sharp from 'sharp';
import { expect, it } from 'vitest';
import { mediaCheckerFixturePath } from '../../../../testing/fixtures/media-uploads';
import { animatedWebpUploadFixture } from '../../../../testing/fixtures/media-animation';
import type { ProcessedVariant } from '../contracts/validated-upload.schema';
import { validateUpload } from './validate-upload';
import { processImage } from './process-image';
async function image(width: number, height: number, orientation?: number) {
  let source = sharp({ create: { width, height, channels: 3, background: '#28506a' } }).jpeg();
  if (orientation) source = source.withMetadata({ orientation });
  const bytes = await source.toBuffer();
  const valid = await validateUpload(
    { bytes, name: 'synthetic.jpg', declaredType: 'image/jpeg' },
    { checkerBinary: mediaCheckerFixturePath() },
  );
  if (!valid.ok || valid.value.kind !== 'image')
    throw new Error('Genuine image control must validate');
  return valid.value;
}
it('creates unique useful widths through2560 preserving aspect ratio', async () => {
  const variants = await processImage(await image(3000, 1500));
  expect(variants.map(({ width, height }) => [width, height])).toEqual([
    [342, 171],
    [640, 320],
    [960, 480],
    [1280, 640],
    [2560, 1280],
  ]);
  for (const variant of variants)
    expect(await sharp(variant.bytes).metadata()).toMatchObject({
      format: 'webp',
      width: variant.width,
      height: variant.height,
    });
});
it('does not upscale or generate repeated copies for a small oriented source', async () => {
  const variants = await processImage(await image(80, 60, 6));
  expect(variants.map(({ width, height }) => [width, height])).toEqual([[60, 80]]);
  expect(await sharp(variants[0].bytes).metadata()).toMatchObject({ width: 60, height: 80 });
});

async function animatedImage(options: Parameters<typeof animatedWebpUploadFixture>[0] = {}) {
  const bytes = await animatedWebpUploadFixture(options);
  const result = await validateUpload(
    { bytes, name: 'synthetic.webp', declaredType: 'image/webp' },
    { checkerBinary: mediaCheckerFixturePath() },
  );
  if (!result.ok || result.value.kind !== 'image') throw new Error('Genuine WebP must validate');
  return result.value;
}

async function expectThreeDistinctFrames(variant: ProcessedVariant, loop = 3, alpha?: number) {
  expect(await sharp(variant.bytes, { animated: true }).metadata()).toMatchObject({
    width: variant.width,
    height: variant.height * 3,
    pageHeight: variant.height,
    pages: 3,
    delay: [100, 200, 300],
    loop,
  });
  const decoded = await sharp(variant.bytes, { animated: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const frameBytes = variant.width * variant.height * decoded.info.channels;
  for (let frame = 0; frame < 3; frame++) {
    const pixel = decoded.data.subarray(
      frame * frameBytes,
      frame * frameBytes + decoded.info.channels,
    );
    expect(pixel[frame]).toBeGreaterThan(220);
    expect(pixel[(frame + 1) % 3]).toBeLessThan(30);
    expect(pixel[(frame + 2) % 3]).toBeLessThan(30);
    if (alpha !== undefined) expect(pixel[3]).toBe(alpha);
  }
}

it.each([0, 3])(
  'preserves all frames, timing and loop=%s at every responsive width',
  async (loop) => {
    const variants = await processImage(await animatedImage({ width: 800, height: 400, loop }));
    expect(variants.map(({ width, height }) => [width, height])).toEqual([
      [342, 171],
      [640, 320],
      [800, 400],
    ]);
    for (const variant of variants) await expectThreeDistinctFrames(variant, loop);
  },
);

it.each([2, 3, 4, 5, 6, 7, 8])(
  'orients each frame for EXIF=%s without flattening or reordering frames',
  async (orientation) => {
    const variants = await processImage(
      await animatedImage({ width: 80, height: 60, orientation }),
    );
    expect(variants.map(({ width, height }) => [width, height])).toEqual(
      orientation >= 5 ? [[60, 80]] : [[80, 60]],
    );
    await expectThreeDistinctFrames(variants[0]);
    expect((await sharp(variants[0].bytes).metadata()).orientation).toBeUndefined();
  },
);

it('preserves animated transparency in every frame', async () => {
  const variants = await processImage(await animatedImage({ width: 80, height: 60, alpha: 128 }));
  await expectThreeDistinctFrames(variants[0], 3, 128);
});

it('rotates the visible left stripe to the top of every EXIF6 frame', async () => {
  const variants = await processImage(
    await animatedImage({ width: 80, height: 60, orientation: 6, whiteStripe: true }),
  );
  expect(variants.map(({ width, height }) => [width, height])).toEqual([[60, 80]]);
  const decoded = await sharp(variants[0].bytes, { animated: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let frame = 0; frame < 3; frame++) {
    const start = frame * 60 * 80 * decoded.info.channels;
    const top = start + (5 * 60 + 30) * decoded.info.channels;
    const middle = start + (40 * 60 + 30) * decoded.info.channels;
    for (let channel = 0; channel < 3; channel++)
      expect(decoded.data[top + channel]).toBeGreaterThan(230);
    expect(decoded.data[middle + frame]).toBeGreaterThan(220);
    expect(decoded.data[middle + ((frame + 1) % 3)]).toBeLessThan(30);
    expect(decoded.data[middle + ((frame + 2) % 3)]).toBeLessThan(30);
  }
});

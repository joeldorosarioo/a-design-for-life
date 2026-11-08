import 'server-only';
import sharp from 'sharp';
import type { ProcessedVariant, ValidatedImage } from '../contracts/validated-upload.schema';

sharp.concurrency(1);

async function orientedFrames(upload: ValidatedImage, width: number, pages: number) {
  let pixels: Buffer | undefined;
  let frameWidth = 0;
  let frameHeight = 0;
  for (let page = 0; page < pages; page++) {
    const frame = await sharp(upload.bytes, { page, pages: 1 })
      .autoOrient()
      .resize({ width, withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (!pixels) {
      pixels = Buffer.allocUnsafe(frame.data.byteLength * pages);
      frameWidth = frame.info.width;
      frameHeight = frame.info.height;
    }
    if (frame.info.width !== frameWidth || frame.info.height !== frameHeight)
      throw new Error('Animation frame dimensions are inconsistent');
    frame.data.copy(pixels, page * frame.data.byteLength);
  }
  if (!pixels) throw new Error('Animation contains no frames');
  return sharp(pixels, {
    raw: { width: frameWidth, height: frameHeight * pages, channels: 4, pageHeight: frameHeight },
  });
}

export async function processImage(upload: ValidatedImage): Promise<ProcessedVariant[]> {
  const widths = [
    ...new Set([342, 640, 960, 1280, 2560].map((width) => Math.min(width, upload.width))),
  ];
  const orientation = upload.animation
    ? (await sharp(upload.bytes, { animated: true }).metadata()).orientation
    : undefined;
  const variants: ProcessedVariant[] = [];
  for (const width of widths) {
    // Sharp cannot rotate a multi-page strip. Reorient complete frames serially
    // only when required; never flip the strip and thereby reverse frame order.
    const image =
      upload.animation && orientation && orientation > 1
        ? await orientedFrames(upload, width, upload.animation.pages)
        : sharp(upload.bytes, { animated: true })
            .autoOrient()
            .resize({ width, withoutEnlargement: true });
    const result = await image
      .webp({
        quality: 80,
        effort: 4,
        ...(upload.animation ? { delay: upload.animation.delay, loop: upload.animation.loop } : {}),
      })
      .toBuffer({ resolveWithObject: true });
    variants.push({
      variant: `w${result.info.width}`,
      type: 'image/webp',
      bytes: new Uint8Array(result.data),
      width: result.info.width,
      height: result.info.pageHeight ?? result.info.height,
    });
  }
  return variants;
}

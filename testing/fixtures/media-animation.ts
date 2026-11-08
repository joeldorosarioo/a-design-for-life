import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

export async function animatedWebpUploadFixture(
  options: {
    width?: number;
    height?: number;
    delays?: number[];
    loop?: number;
    orientation?: number;
    alpha?: number;
    whiteStripe?: boolean;
  } = {},
) {
  const width = options.width ?? 370;
  const height = options.height ?? 285;
  const delays = options.delays ?? [100, 200, 300];
  const channels = options.alpha === undefined ? 3 : 4;
  const pixels = Buffer.alloc(width * height * channels * delays.length);
  for (let frame = 0; frame < delays.length; frame++)
    for (let pixel = 0; pixel < width * height; pixel++) {
      const offset = frame * width * height * channels + pixel * channels;
      if (options.whiteStripe && pixel % width < width / 4) pixels.fill(255, offset, offset + 3);
      else pixels[offset + (frame % 3)] = 255;
      if (channels === 4) pixels[offset + 3] = options.alpha!;
    }
  const source = sharp(pixels, {
    raw: { width, height: height * delays.length, channels, pageHeight: height },
  });
  if (options.orientation) source.withMetadata({ orientation: options.orientation });
  return source.webp({ lossless: true, loop: options.loop ?? 3, delay: delays }).toBuffer();
}

export function apngUploadFixture(options: { hiddenDefault?: boolean } = {}) {
  return readFileSync(
    new URL(
      options.hiddenDefault
        ? './media-animation-assets/apng-hidden-frame.png'
        : './media-animation-assets/cogs-apng.png',
      import.meta.url,
    ),
  );
}
export async function animatedAvifUploadFixture() {
  return readFile(new URL('./media-animation-assets/colors-animated-8bpc.avif', import.meta.url));
}

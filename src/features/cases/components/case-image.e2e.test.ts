import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import sharp from 'sharp';
import { expect, test } from '@playwright/test';
let markupByScenario: Record<string, string>;
let css: string;
test.beforeAll(async () => {
  // The app's runner enables react-server. Render client image markup in ordinary Node.
  markupByScenario = JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        String.raw`
    import { readFile } from 'node:fs/promises';
    import path from 'node:path';
    import { createRequire } from 'node:module';
    import { runInNewContext } from 'node:vm';
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { build } from 'esbuild';
    const component = await build({
      stdin: { contents: await readFile('src/features/cases/components/case-image.tsx', 'utf8'), loader: 'tsx', sourcefile: 'case-image.cts', resolveDir: path.resolve('src/features/cases/components') },
      jsx: 'automatic', bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false,
    });
    const renderedModule = { exports: {} };
    runInNewContext(component.outputFiles[0].text, { module: renderedModule, exports: renderedModule.exports, require: createRequire(import.meta.url) });
    const markup = {};
    for (const kind of ['article', 'pair'])
      for (const mediaMode of ['published', 'preview'])
        for (const height of [600, 900, 0]) {
          const image = { mediaId: '00000000-0000-4000-8000-000000000001', decorative: false, alt: 'Delayed image', caption: null, ...(height ? { intrinsicSize: { width: 600, height } } : {}) };
          markup[[mediaMode, kind, height].join(':')] = renderToStaticMarkup(createElement(renderedModule.exports.CaseImage, { image, kind, mediaMode }));
        }
    process.stdout.write(JSON.stringify(markup));
  `,
      ],
      { encoding: 'utf8', windowsHide: true },
    ),
  );
  const source = path.resolve('src/stylesheets/globals.css');
  css = (
    await postcss([tailwindcss({ optimize: false, transformAssetUrls: false })]).process(
      await readFile(source, 'utf8'),
      { from: source },
    )
  ).css;
});

for (const kind of ['article', 'pair'] as const)
  for (const mediaMode of ['published', 'preview'] as const)
    for (const height of [600, 900, 0])
      test(`${mediaMode} ${kind} keeps delayed ${height === 0 ? 'legacy square' : height === 600 ? 'square' : 'portrait'} images stable`, async ({
        page,
      }) => {
        const expectedHeight = height || 600 * (kind === 'article' ? 567 / 1008 : 275 / 488);
        const bytes = await sharp({
          create: { width: 600, height: height || 600, channels: 3, background: '#a02e43' },
        })
          .png()
          .toBuffer();
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route('http://images.invalid/**', async (route) => {
          await gate;
          await route.fulfill({ contentType: 'image/png', body: bytes });
        });
        const markup = markupByScenario[[mediaMode, kind, height].join(':')];
        try {
          await page.setContent(
            `<base href="http://images.invalid"><style>${css}</style><main style="width:600px">${markup}<p>Following paragraph</p></main>`,
            { waitUntil: 'domcontentloaded' },
          );
          const image = page.getByRole('img', { name: 'Delayed image' });
          const before = await image.boundingBox();
          const paragraphBefore = await page.getByText('Following paragraph').boundingBox();
          release();
          await image.evaluate((element: HTMLImageElement) => element.decode());
          const after = await image.boundingBox();
          const paragraphAfter = await page.getByText('Following paragraph').boundingBox();
          expect(before!.height).toBeCloseTo(expectedHeight, 1);
          expect(after!.height).toBeCloseTo(expectedHeight, 1);
          expect(paragraphAfter!.y).toBeCloseTo(paragraphBefore!.y, 2);
        } finally {
          release();
        }
      });

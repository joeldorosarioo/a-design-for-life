import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { navigationPtFixture } from '../../../../testing/fixtures/content';
import { renderCaseRouteResponse } from './case-route-response';
import { caseStatePresentationSchema } from '../contracts/case-state-presentation.schema';

// CSS/keyboard proof only. This server calls the actual renderer with a strict
// synthetic presentation; it does not start Next, connect Native or publish data.
let server: Server;
let origin: string;
const title = 'Estado sintético';
test.beforeAll(async () => {
  const presentation = caseStatePresentationSchema.parse({
    locale: 'pt',
    status: 404,
    title,
    description: Array.from(
      { length: 24 },
      (_, index) =>
        `Parágrafo sintético de teste ${index + 1}. Este material existe somente para verificar navegação por teclado e rolagem.`,
    ).join('\n\n'),
    navigation: navigationPtFixture,
  });
  const response = renderCaseRouteResponse({ status: 404 }, 'pt', presentation);
  const html = await response.text();
  if (!html.includes('class="case-state-document"') || !html.includes(title))
    throw new Error('Precondition: actual editorial renderer must be selected, never A1 fallback.');
  const css = await readFile(path.resolve('public/_portfolio/case-state.css'));
  const divider = await readFile(path.resolve('public/figma/footer-divider.svg'));
  server = createServer((request, outgoing) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (pathname === '/_portfolio/case-state.css') {
      outgoing.writeHead(200, { 'Content-Type': 'text/css' });
      outgoing.end(css);
    } else if (pathname === '/figma/footer-divider.svg') {
      outgoing.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      outgoing.end(divider);
    } else {
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(html);
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Ephemeral test listener unavailable.');
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
});
for (const width of [1440, 390])
  for (const textScale of [100, 200]) {
    test(`${width}px/${textScale}%: keyboard skip focuses main and keeps its heading below the sticky header`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      expect((await page.goto(`${origin}/synthetic-negative-state`))?.status()).toBe(404);
      await expect(page.locator('body')).toHaveClass('case-state-document');
      await expect(page.locator('main h1')).toHaveText(title);
      await expect(page.locator('header')).toHaveCSS('position', 'sticky');
      if (textScale === 200) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
      await page.keyboard.press('Tab');
      await expect(page.locator('.case-state-skip')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
      const geometry = await page.evaluate(() => {
        const header = document.querySelector('header')!.getBoundingClientRect();
        const heading = document.querySelector('main h1')!.getBoundingClientRect();
        return {
          headerBottom: header.bottom,
          headingTop: heading.top,
          headingBottom: heading.bottom,
          viewportHeight: innerHeight,
        };
      });
      console.log(JSON.stringify({ width, textScale, ...geometry }));
      expect(geometry.headingTop).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
      expect(geometry.headingTop).toBeLessThan(geometry.viewportHeight);
    });
  }

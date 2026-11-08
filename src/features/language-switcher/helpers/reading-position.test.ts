// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { captureReadingAnchor, readingTarget, restoreReadingAnchor } from './reading-position';
afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.style.removeProperty('--portfolio-header-height');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'fonts');
});
function rect(element: Element, top: number, height: number) {
  element.getBoundingClientRect = () => ({
    top,
    bottom: top + height,
    left: 0,
    right: 600,
    width: 600,
    height,
    x: 0,
    y: top,
    toJSON() {},
  });
}
it('captures the visible upcoming section below the persistent Header and its explicit ancestor chain', () => {
  document.body.innerHTML =
    '<header data-portfolio-header></header><main><section data-reading-key="home-about">Earlier text</section><section data-reading-key="home-approach"><div data-reading-key="method-one">Method text</div></section></main>';
  rect(document.querySelector('header')!, 0, 96);
  rect(document.querySelector('[data-reading-key="home-about"]')!, -1000, 1200);
  rect(document.querySelector('[data-reading-key="home-approach"]')!, 200, 600);
  rect(document.querySelector('[data-reading-key="method-one"]')!, 400, 300);
  expect(captureReadingAnchor()).toEqual({ key: 'home-approach', top: 200, ancestors: [] });
});
it('captures an active long inner block with its actual containing section instead of an unrelated sibling', () => {
  document.body.innerHTML =
    '<main><section data-reading-key="section-a"><div data-reading-key="block-a">Reading long text</div></section><section data-reading-key="section-b">Next</section></main>';
  rect(document.querySelector('[data-reading-key="section-a"]')!, -1000, 1700);
  rect(document.querySelector('[data-reading-key="block-a"]')!, -200, 800);
  rect(document.querySelector('[data-reading-key="section-b"]')!, 700, 200);
  expect(captureReadingAnchor()).toEqual({ key: 'block-a', top: -200, ancestors: ['section-a'] });
});
it('uses an exact visible identity, then only its captured ancestors, then the page top', () => {
  document.body.innerHTML =
    '<main><section data-reading-key="parent">Parent</section><div data-reading-key="unrelated">Sibling</div></main>';
  rect(document.querySelector('[data-reading-key="parent"]')!, 400, 200);
  rect(document.querySelector('[data-reading-key="unrelated"]')!, 500, 200);
  const anchor = { key: 'missing-block', top: 130, ancestors: ['parent'] };
  expect(readingTarget(anchor)).toEqual({
    element: document.querySelector('[data-reading-key="parent"]'),
    adjusted: true,
  });
  document.querySelector('[data-reading-key="parent"]')!.remove();
  expect(readingTarget(anchor)).toEqual({ element: null, adjusted: true });
});
it('ignores empty keyed wrappers and does not fabricate a text or index identity', () => {
  document.body.innerHTML = '<main><section data-reading-key="empty"></section></main>';
  rect(document.querySelector('section')!, 100, 300);
  expect(captureReadingAnchor()).toBeNull();
});
it('captures the innermost card when its start coincides with its keyed section', () => {
  document.body.innerHTML =
    '<main><section data-reading-key="cases-list"><article data-reading-key="case-card:one">Case</article></section></main>';
  rect(document.querySelector('section')!, 200, 600);
  rect(document.querySelector('article')!, 200, 300);
  expect(captureReadingAnchor()).toEqual({
    key: 'case-card:one',
    top: 200,
    ancestors: ['cases-list'],
  });
});
it('reports a layout deadline instead of certifying restoration while fonts remain unresolved', async () => {
  document.body.innerHTML = '<main><section data-reading-key="section">Text</section></main>';
  rect(document.querySelector('section')!, 200, 300);
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: new Promise(() => {}) },
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  const result = await restoreReadingAnchor(
    { key: 'section', top: 200, ancestors: [] },
    { signal: new AbortController().signal, timeoutMs: 1 },
  );
  expect(result).toMatchObject({ timedOut: true, cancelled: false });
});
it('does not certify a still-loading image after decode rejects for a superseded responsive candidate', async () => {
  document.body.innerHTML =
    '<main><section data-reading-key="section"><img src="/pending.png" alt="Pending" /></section></main>';
  const image = document.querySelector('img')!;
  rect(document.querySelector('section')!, 200, 600);
  rect(image, 200, 300);
  Object.defineProperty(image, 'complete', { configurable: true, value: false });
  image.decode = vi
    .fn()
    .mockRejectedValue(new DOMException('The source image cannot be decoded.', 'EncodingError'));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  const result = await restoreReadingAnchor(
    { key: 'section', top: 200, ancestors: [] },
    { signal: new AbortController().signal, timeoutMs: 1 },
  );
  expect(result).toMatchObject({ timedOut: true, cancelled: false });
});
it('can finish exact restoration after the real replacement image loads despite its earlier decode rejection', async () => {
  document.body.innerHTML =
    '<main><section data-reading-key="section"><img src="/pending.png" alt="Pending" /></section></main>';
  const image = document.querySelector('img')!;
  rect(document.querySelector('section')!, 200, 600);
  rect(image, 200, 300);
  let loaded = false;
  Object.defineProperty(image, 'complete', { configurable: true, get: () => loaded });
  image.decode = vi.fn(() =>
    loaded
      ? Promise.resolve()
      : Promise.reject(new DOMException('Superseded candidate.', 'EncodingError')),
  );
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  const pending = restoreReadingAnchor(
    { key: 'section', top: 200, ancestors: [] },
    { signal: new AbortController().signal },
  );
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(frames, 'no final frame may be certified while the actual image is loading').toHaveLength(
    0,
  );
  loaded = true;
  image.dispatchEvent(new Event('load'));
  for (let index = 0; index < 12; index++) {
    await Promise.resolve();
    for (const callback of frames.splice(0)) callback(0);
  }
  expect(await pending).toMatchObject({ timedOut: false, cancelled: false, clamped: false });
});

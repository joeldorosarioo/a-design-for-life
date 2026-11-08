// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadingPositionProvider } from './reading-position-provider';
import { LanguageToggle } from './language-toggle';
import type { LanguageToggleProps } from '../contracts/language-control.schema';
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const props: LanguageToggleProps = {
  locale: 'pt',
  sourcePage: { kind: 'home' },
  pathname: '/pt',
  destination: { kind: 'equivalent', href: '/en' },
  labels: {
    languageLabel: 'Language',
    caseMissing: 'Missing translated case',
    readingPositionAdjusted: 'Reading adjusted',
    failure: 'Switch unavailable',
  },
};
beforeEach(() => {
  router.push.mockReset();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0),
  );
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  // jsdom has no resource loader here; the static flag is an already-loaded
  // boundary. Incomplete images and real browser loading have separate tests.
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
});
it('keeps the current page and announces a failed manual preference instead of navigating', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 503 })),
  );
  const user = userEvent.setup();
  render(
    <ReadingPositionProvider>
      <LanguageToggle {...props} />
    </ReadingPositionProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Switch unavailable');
  expect(router.push).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'English' })).toBeEnabled();
});
it('serializes rapid manual clicks, saves only the target locale and commits language once', async () => {
  let complete!: (response: Response) => void;
  const send = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
  );
  vi.stubGlobal('fetch', send);
  const user = userEvent.setup();
  const view = render(
    <ReadingPositionProvider>
      <LanguageToggle {...props} />
    </ReadingPositionProvider>,
  );
  const button = screen.getByRole('button', { name: 'English' });
  await user.click(button);
  await user.click(button);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]).toMatchObject([
    '/language-preference',
    { method: 'POST', body: '{"locale":"en"}' },
  ]);
  await act(async () => complete(new Response(null, { status: 204 })));
  await waitFor(() =>
    expect(router.push).toHaveBeenCalledExactlyOnceWith('/en', { scroll: false }),
  );
  view.rerender(
    <ReadingPositionProvider>
      <LanguageToggle
        {...props}
        locale="en"
        pathname="/en"
        destination={{ kind: 'equivalent', href: '/pt' }}
      />
    </ReadingPositionProvider>,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Português' })).toBeEnabled());
  expect(document.documentElement.lang).toBe('en');
});
it('cancels an old pending choice on browser history navigation before its response can navigate', async () => {
  let complete!: (response: Response) => void;
  const send = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
  );
  vi.stubGlobal('fetch', send);
  const user = userEvent.setup();
  render(
    <ReadingPositionProvider>
      <LanguageToggle {...props} />
    </ReadingPositionProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'English' }));
  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await act(async () => complete(new Response(null, { status: 204 })));
  expect(router.push).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'English' })).toBeEnabled();
});

it('does not restore reading or announce success when the committed target is unavailable', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  const user = userEvent.setup();
  const view = render(
    <ReadingPositionProvider>
      <LanguageToggle {...props} />
    </ReadingPositionProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'English' }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  view.rerender(
    <ReadingPositionProvider>
      <LanguageToggle
        {...props}
        locale="en"
        pathname="/en"
        status={503}
        destination={{ kind: 'unavailable' }}
      />
    </ReadingPositionProvider>,
  );
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(document.documentElement.lang).toBe('en');
});

it('stops queued layout correction when an unrelated page commits during restoration', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  const user = userEvent.setup();
  const view = render(
    <ReadingPositionProvider>
      <LanguageToggle {...props} />
    </ReadingPositionProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'English' }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  let fontsLoaded!: () => void;
  const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      ready: new Promise<void>((resolve) => {
        fontsLoaded = resolve;
      }),
    },
  });
  try {
    view.rerender(
      <ReadingPositionProvider>
        <LanguageToggle
          {...props}
          locale="en"
          pathname="/en"
          destination={{ kind: 'equivalent', href: '/pt' }}
        />
      </ReadingPositionProvider>,
    );
    const correctionsBeforeNewPage = vi.mocked(window.scrollTo).mock.calls.length;
    expect(correctionsBeforeNewPage).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Português' })).toBeDisabled();
    view.rerender(
      <ReadingPositionProvider>
        <LanguageToggle
          {...props}
          sourcePage={{ kind: 'about' }}
          pathname="/pt/sobre"
          destination={{ kind: 'equivalent', href: '/en/about' }}
        />
      </ReadingPositionProvider>,
    );
    await act(async () => {
      fontsLoaded();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(window.scrollTo).toHaveBeenCalledTimes(correctionsBeforeNewPage);
    expect(screen.getByRole('button', { name: 'English' })).toBeEnabled();
  } finally {
    fontsLoaded();
    if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
    else Reflect.deleteProperty(document, 'fonts');
  }
});
it('restores the captured key through a locale layout provider remount', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  const user = userEvent.setup();
  let sectionTop = 200;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const top = this.dataset.readingKey ? sectionTop : 0;
    const height = this.tagName === 'HEADER' ? 96 : 600;
    return {
      top,
      bottom: top + height,
      left: 0,
      right: 600,
      width: 600,
      height,
      x: 0,
      y: top,
      toJSON() {},
    };
  });
  const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(((options: ScrollToOptions) => {
    sectionTop -= options.top ?? 0;
  }) as typeof window.scrollBy);
  const view = render(
    <ReadingPositionProvider>
      <header data-portfolio-header />
      <LanguageToggle {...props} />
      <main>
        <section data-reading-key="home-approach">Approach</section>
      </main>
    </ReadingPositionProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'English' }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  view.unmount();
  sectionTop = 704;
  render(
    <ReadingPositionProvider>
      <header data-portfolio-header />
      <LanguageToggle
        {...props}
        locale="en"
        pathname="/en"
        destination={{ kind: 'equivalent', href: '/pt' }}
      />
      <main>
        <section data-reading-key="home-approach">Approach translated</section>
      </main>
    </ReadingPositionProvider>,
  );
  await waitFor(() => expect(sectionTop).toBe(200));
  expect(scroll).toHaveBeenCalledWith({ top: 504, behavior: 'instant' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Português' })).toBeEnabled());
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

// A target-locale flag misidentifies the current language while the action stays translated.
it.each([
  ['pt', '/pt', '/en', 'English', '/figma/language-br.svg'],
  ['en', '/en', '/pt', 'Português', '/figma/language-en.svg'],
] as const)(
  'identifies current %s visually while naming the target language',
  (locale, pathname, href, label, flag) => {
    render(
      <ReadingPositionProvider>
        <LanguageToggle
          {...props}
          locale={locale}
          pathname={pathname}
          destination={{ kind: 'equivalent', href }}
        />
      </ReadingPositionProvider>,
    );
    const control = screen.getByRole('button', { name: label });
    expect(control.querySelector('img')).toHaveAttribute('src', flag);
    expect(control.querySelector('img')).toHaveAttribute('alt', '');
    expect(control).toHaveAttribute('lang', locale === 'pt' ? 'en' : 'pt');
  },
);

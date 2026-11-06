// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mountDocumentAnalytics,
  type GoogleScriptLoader,
  type AnalyticsHost,
} from './document-analytics';
import type { AnalyticsRuntime } from '../analytics-session';

const runtime: AnalyticsRuntime = {
  environment: 'production',
  area: 'public',
  preview: false,
  publicSiteEnabled: true,
  measurementId: 'G-TESTONLY1',
  siteOrigin: 'https://portfolio.example.invalid',
};
const home = { locale: 'en', pagePath: '/en' } as const;
const about = { locale: 'en', pagePath: '/en/about' } as const;
const frames: HTMLIFrameElement[] = [];
afterEach(() => {
  for (const frame of frames.splice(0)) frame.remove();
  vi.restoreAllMocks();
});

function fixture() {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  frames.push(frame);
  const doc = frame.contentDocument!;
  Object.defineProperty(doc, 'featurePolicy', {
    configurable: true,
    value: { features: () => ['ch-ua-high-entropy-values'], allowsFeature: (): boolean => false },
  });
  const host = frame.contentWindow! as AnalyticsHost;
  const scripts: HTMLScriptElement[] = [];
  const loadScript: GoogleScriptLoader = (script) => {
    scripts.push(script);
  };
  const commands = () => (host.dataLayer ?? []).map((entry) => Array.from(entry));
  const eventCommands = () => commands().filter((command) => command[0] === 'event');
  function link(purpose?: string) {
    const anchor = doc.createElement('a');
    anchor.href = 'mailto:synthetic-secret@example.invalid';
    anchor.target = '_blank';
    anchor.textContent = 'Synthetic contact label never measured';
    if (purpose) anchor.setAttribute('data-analytics-purpose', purpose);
    doc.body.appendChild(anchor);
    return anchor;
  }
  async function click(target: Element, type = 'click', init: MouseEventInit = {}) {
    const event = new MouseEvent(type, { button: 0, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    await Promise.resolve();
    return event;
  }
  return { doc, host, scripts, loadScript, commands, eventCommands, link, click };
}

describe('browser document analytics, entirely intercepted script boundary', () => {
  it.each([
    { environment: 'local' },
    { environment: 'test' },
    { environment: 'staging' },
    { area: 'admin' },
    { area: 'private' },
    { preview: true },
    { publicSiteEnabled: false },
    { measurementId: null },
  ])(
    'does not initialize globals, loader or contact listeners for excluded runtime %j',
    (override) => {
      const f = fixture();
      const registrations = vi.spyOn(f.doc, 'addEventListener');
      mountDocumentAnalytics({
        document: f.doc,
        runtime: { ...runtime, ...override },
        context: home,
        loadScript: f.loadScript,
      });
      expect(f.scripts).toEqual([]);
      expect(f.host.dataLayer).toBeUndefined();
      expect(f.host.gtag).toBeUndefined();
      expect(
        registrations.mock.calls.filter(([name]) => name === 'click' || name === 'auxclick'),
      ).toEqual([]);
    },
  );

  it.each([
    undefined,
    null,
    {},
    { features: false, allowsFeature: (): boolean => false },
    { features: () => ['ch-ua-high-entropy-values'] },
    { features: () => [], allowsFeature: (): boolean => false },
    { features: () => null, allowsFeature: (): boolean => false },
    { features: () => 'ch-ua-high-entropy-values', allowsFeature: (): boolean => false },
    { features: () => ['ch-ua-high-entropy-values'], allowsFeature: (): boolean => true },
    { features: () => ['ch-ua-high-entropy-values'], allowsFeature: (): undefined => undefined },
    {
      features: () => {
        throw new Error('Synthetic policy error');
      },
      allowsFeature: (): boolean => false,
    },
    {
      features: () => ['ch-ua-high-entropy-values'],
      allowsFeature: () => {
        throw new Error('Synthetic policy error');
      },
    },
  ])(
    'does not create controller globals, listeners or SDK when device policy cannot be verified: %j',
    (policy) => {
      const f = fixture();
      Object.defineProperty(f.doc, 'featurePolicy', { configurable: true, value: policy });
      const registrations = vi.spyOn(f.doc, 'addEventListener');
      expect(() =>
        mountDocumentAnalytics({
          document: f.doc,
          runtime,
          context: home,
          loadScript: f.loadScript,
        }),
      ).not.toThrow();
      expect(f.scripts).toEqual([]);
      expect(f.host.dataLayer).toBeUndefined();
      expect(f.host.gtag).toBeUndefined();
      expect(
        registrations.mock.calls.filter(([name]) => name === 'click' || name === 'auxclick'),
      ).toEqual([]);
    },
  );

  it('fails closed when the policy accessor itself throws', () => {
    const f = fixture();
    Object.defineProperty(f.doc, 'featurePolicy', {
      configurable: true,
      get() {
        throw new Error('Synthetic accessor error');
      },
    });
    expect(() =>
      mountDocumentAnalytics({ document: f.doc, runtime, context: home, loadScript: f.loadScript }),
    ).not.toThrow();
    expect(f.scripts).toEqual([]);
    expect(f.host.dataLayer).toBeUndefined();
  });

  it('stops an existing controller if its device restriction is no longer verifiable', async () => {
    const f = fixture();
    mountDocumentAnalytics({ document: f.doc, runtime, context: home, loadScript: f.loadScript });
    const email = f.link('email');
    Object.defineProperty(f.doc, 'featurePolicy', { configurable: true, value: undefined });
    mountDocumentAnalytics({ document: f.doc, runtime, context: about, loadScript: f.loadScript });
    await f.click(email);
    expect(f.eventCommands().map((command) => command[1])).toEqual(['page_view']);
  });

  it('keeps the ordinary production entry fail closed while actual SDK policy evidence is missing', () => {
    const f = fixture();
    const registrations = vi.spyOn(f.doc, 'addEventListener');
    mountDocumentAnalytics({ document: f.doc, runtime, context: home });
    expect(f.scripts).toEqual([]);
    expect(f.host.dataLayer).toBeUndefined();
    expect(f.host.gtag).toBeUndefined();
    expect(
      registrations.mock.calls.filter(([name]) => name === 'click' || name === 'auxclick'),
    ).toEqual([]);
  });

  it('queues genuine arguments objects with denied consent before the intercepted async no-referrer script load', () => {
    const f = fixture();
    let commandsAtLoad: unknown[][] = [];
    mountDocumentAnalytics({
      document: f.doc,
      runtime,
      context: home,
      loadScript(script) {
        commandsAtLoad = f.commands();
        f.scripts.push(script);
      },
    });
    expect(f.scripts).toHaveLength(1);
    expect(f.scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TESTONLY1');
    expect(f.scripts[0].async).toBe(true);
    expect(f.scripts[0].referrerPolicy).toBe('no-referrer');
    expect(commandsAtLoad.map((command) => command[0])).toEqual([
      'consent',
      'set',
      'js',
      'config',
      'event',
    ]);
    expect(commandsAtLoad[0]).toEqual([
      'consent',
      'default',
      {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]);
    expect(commandsAtLoad[4]).toEqual([
      'event',
      'page_view',
      {
        send_to: 'G-TESTONLY1',
        language: 'en',
        page_location: 'https://portfolio.example.invalid/en',
        page_referrer: '',
        page_title: '',
      },
    ]);
    for (const entry of f.host.dataLayer!) {
      expect(Array.isArray(entry)).toBe(false);
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]');
    }
  });

  it('reuses one session and script across remounts and completed A to B to A views', () => {
    const f = fixture();
    const a = mountDocumentAnalytics({
      document: f.doc,
      runtime,
      context: home,
      loadScript: f.loadScript,
    });
    a();
    const same = mountDocumentAnalytics({
      document: f.doc,
      runtime,
      context: home,
      loadScript: f.loadScript,
    });
    same();
    const b = mountDocumentAnalytics({
      document: f.doc,
      runtime,
      context: about,
      loadScript: f.loadScript,
    });
    b();
    mountDocumentAnalytics({ document: f.doc, runtime, context: home, loadScript: f.loadScript });
    expect(f.scripts).toHaveLength(1);
    expect(f.commands().filter((command) => command[0] === 'config')).toHaveLength(1);
    expect(
      f.eventCommands().map((command) => (command[2] as { page_location: string }).page_location),
    ).toEqual([
      'https://portfolio.example.invalid/en',
      'https://portfolio.example.invalid/en/about',
      'https://portfolio.example.invalid/en',
    ]);
  });

  it('tracks only fixed-purpose bubbling native actions with sanitized context and preserves default action', async () => {
    const f = fixture();
    mountDocumentAnalytics({ document: f.doc, runtime, context: home, loadScript: f.loadScript });
    const email = f.link('email');
    const child = f.doc.createElement('span');
    email.appendChild(child);
    const emailEvent = await f.click(child);
    await f.click(f.link('linkedin'), 'click', { ctrlKey: true });
    await f.click(f.link('resume'), 'click', { detail: 0 });
    await f.click(f.link('resume'), 'auxclick', { button: 1 });
    expect(emailEvent.defaultPrevented).toBe(false);
    expect(f.eventCommands()).toEqual([
      [
        'event',
        'page_view',
        {
          send_to: 'G-TESTONLY1',
          language: 'en',
          page_location: 'https://portfolio.example.invalid/en',
          page_referrer: '',
          page_title: '',
        },
      ],
      [
        'event',
        'contact_email_click',
        {
          send_to: 'G-TESTONLY1',
          language: 'en',
          page_location: 'https://portfolio.example.invalid/en',
          page_referrer: '',
          page_title: '',
        },
      ],
      [
        'event',
        'contact_linkedin_click',
        {
          send_to: 'G-TESTONLY1',
          language: 'en',
          page_location: 'https://portfolio.example.invalid/en',
          page_referrer: '',
          page_title: '',
        },
      ],
      [
        'event',
        'resume_open',
        {
          send_to: 'G-TESTONLY1',
          language: 'en',
          page_location: 'https://portfolio.example.invalid/en',
          page_referrer: '',
          page_title: '',
        },
      ],
      [
        'event',
        'resume_open',
        {
          send_to: 'G-TESTONLY1',
          language: 'en',
          page_location: 'https://portfolio.example.invalid/en',
          page_referrer: '',
          page_title: '',
        },
      ],
    ]);
  });

  it('waits for later native preventDefault checks and ignores arbitrary/secondary actions', async () => {
    const f = fixture();
    mountDocumentAnalytics({ document: f.doc, runtime, context: home, loadScript: f.loadScript });
    const canceled = f.link('email');
    f.doc.addEventListener('click', (event) => {
      if (event.target === canceled) event.preventDefault();
    });
    await f.click(canceled);
    await f.click(f.link('resume'), 'click', { button: 1 });
    await f.click(f.link('resume'), 'auxclick', { button: 2 });
    await f.click(f.link('purchase'));
    await f.click(f.link());
    const button = f.doc.createElement('button');
    button.setAttribute('data-analytics-purpose', 'resume');
    f.doc.body.appendChild(button);
    await f.click(button);
    expect(f.eventCommands().map((command) => command[1])).toEqual(['page_view']);
  });

  it('removes contact handling on cleanup/exclusion and cancels queued actions from an obsolete context', async () => {
    const f = fixture();
    const release = mountDocumentAnalytics({
      document: f.doc,
      runtime,
      context: home,
      loadScript: f.loadScript,
    });
    const link = f.link('resume');
    const pending = f.click(link);
    release();
    await pending;
    await f.click(link);
    mountDocumentAnalytics({ document: f.doc, runtime, context: home, loadScript: f.loadScript });
    mountDocumentAnalytics({
      document: f.doc,
      runtime: { ...runtime, area: 'private' },
      context: home,
      loadScript: f.loadScript,
    });
    await f.click(link);
    expect(f.eventCommands().map((command) => command[1])).toEqual(['page_view']);
  });

  it.each(['gtag', 'dataLayer'] as const)(
    'fails closed on unknown preexisting %s ownership without reusing or retrying it',
    (name) => {
      const f = fixture();
      const unknown = name === 'gtag' ? () => {} : [];
      Object.defineProperty(f.host, name, { value: unknown, configurable: true, writable: true });
      mountDocumentAnalytics({ document: f.doc, runtime, context: home, loadScript: f.loadScript });
      expect(f.scripts).toEqual([]);
      expect(f.host[name]).toBe(unknown);
      delete f.host[name];
      mountDocumentAnalytics({
        document: f.doc,
        runtime,
        context: about,
        loadScript: f.loadScript,
      });
      expect(f.scripts).toEqual([]);
      expect(f.host.dataLayer).toBeUndefined();
    },
  );

  it('stops permanently on loader throw and keeps native contact navigation working', async () => {
    const f = fixture();
    let loads = 0;
    const broken: GoogleScriptLoader = () => {
      loads++;
      throw new Error('blocked');
    };
    const release = mountDocumentAnalytics({
      document: f.doc,
      runtime,
      context: home,
      loadScript: broken,
    });
    const before = f.commands();
    expect((await f.click(f.link('resume'))).defaultPrevented).toBe(false);
    release();
    mountDocumentAnalytics({ document: f.doc, runtime, context: about, loadScript: broken });
    expect(loads).toBe(1);
    expect(f.commands()).toEqual(before);
  });

  it('stops permanently on script error or changed runtime ownership', async () => {
    const f = fixture();
    mountDocumentAnalytics({ document: f.doc, runtime, context: home, loadScript: f.loadScript });
    expect(f.scripts).toHaveLength(1);
    f.scripts[0].dispatchEvent(new Event('error'));
    await f.click(f.link('resume'));
    mountDocumentAnalytics({ document: f.doc, runtime, context: about, loadScript: f.loadScript });
    expect(f.scripts).toHaveLength(1);
    expect(f.eventCommands().map((command) => command[1])).toEqual(['page_view']);
    const g = fixture();
    mountDocumentAnalytics({ document: g.doc, runtime, context: home, loadScript: g.loadScript });
    const before = g.commands();
    mountDocumentAnalytics({
      document: g.doc,
      runtime: { ...runtime, measurementId: 'G-OTHERTEST' },
      context: about,
      loadScript: g.loadScript,
    });
    await g.click(g.link('email'));
    expect(g.commands()).toEqual(before);
    expect(g.scripts).toHaveLength(1);
  });

  it('never reads URL/referrer/title/cookie/storage and does not accept outside calls to its owned global queue', () => {
    const f = fixture();
    for (const key of ['URL', 'referrer', 'title', 'cookie']) {
      Object.defineProperty(f.doc, key, {
        configurable: true,
        get() {
          throw new Error('forbidden document read');
        },
      });
    }
    for (const key of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(f.host, key, {
        configurable: true,
        get() {
          throw new Error('forbidden storage read');
        },
      });
    }
    expect(() =>
      mountDocumentAnalytics({ document: f.doc, runtime, context: home, loadScript: f.loadScript }),
    ).not.toThrow();
    expect(f.eventCommands().map((command) => command[1])).toEqual(['page_view']);
    const before = f.commands();
    f.host.gtag?.('event', 'unapproved', { email: 'secret' });
    expect(f.commands()).toEqual(before);
  });
});

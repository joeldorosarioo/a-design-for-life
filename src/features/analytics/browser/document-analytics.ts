import { hasRestrictedDevicePolicy } from './device-policy';
import { wasAnalyticsContactHandled } from './contact-event-ownership';
import { canMeasure } from '../analytics-policy';
import { analyticsTransportConfigSchema, type AnalyticsRuntime } from '../analytics-session';
import { createGtagSession } from '../gtag-session';
import {
  publicAnalyticsContextSchema,
  type AnalyticsContactPurpose,
  type PublicAnalyticsContext,
} from '../contracts/event.schema';

export type AnalyticsHost = Window & {
  dataLayer?: IArguments[];
  gtag?: (...args: unknown[]) => void;
};
/** Only the script execution/request boundary is injected for fully intercepted inspection. */
export type GoogleScriptLoader = (script: HTMLScriptElement) => void;
export type DocumentAnalyticsInput = {
  document: Document;
  runtime: AnalyticsRuntime;
  context: PublicAnalyticsContext;
  loadScript?: GoogleScriptLoader | null;
};

type Controller = {
  matches(measurementId: string, siteOrigin: string, loader: GoogleScriptLoader): boolean;
  activate(context: PublicAnalyticsContext): () => void;
  exclude(): void;
  failClosed(): void;
};
// Keys identify document lifetimes only. They never leave this module or persist in storage.
const documents = new WeakMap<Document, Controller>();
const noop = () => {};

function createController(
  doc: Document,
  runtime: AnalyticsRuntime,
  loader: GoogleScriptLoader,
): Controller | null {
  const host = doc.defaultView as AnalyticsHost | null;
  if (!host) return null;
  let failed = false;
  let active: { token: symbol; context: PublicAnalyticsContext } | null = null;
  let listening = false;
  let queue: IArguments[] | null = null;
  let queueFunction: AnalyticsHost['gtag'];
  let dispatching = false;
  let requested = false;

  function exclude() {
    active = null;
    if (listening) {
      doc.removeEventListener('click', onContact);
      doc.removeEventListener('auxclick', onContact);
      listening = false;
    }
  }
  function failClosed() {
    failed = true;
    exclude();
  }
  function ownsGlobals() {
    return (
      !!queue &&
      Object.getOwnPropertyDescriptor(host!, 'dataLayer')?.value === queue &&
      Object.getOwnPropertyDescriptor(host!, 'gtag')?.value === queueFunction
    );
  }
  function createOwnedQueue() {
    if (
      'dataLayer' in host! ||
      'gtag' in host! ||
      Array.from(doc.scripts).some((script) => {
        const src = script.getAttribute('src') ?? '';
        return src.includes('googletagmanager.com') || src.includes('google-analytics.com');
      })
    )
      throw new Error('Analytics ownership conflict');
    queue = [];
    queueFunction = function () {
      if (!dispatching || failed || !active) return;
      // Google's native snippet queues genuine Arguments objects; rest arrays are not substituted.
      // eslint-disable-next-line prefer-rest-params
      queue!.push(arguments);
    };
    host!.dataLayer = queue;
    host!.gtag = queueFunction;
  }

  const session = createGtagSession({
    runtime,
    dispatch(...command) {
      try {
        if (failed || !active) throw new Error('Inactive analytics document');
        if (!queue) createOwnedQueue();
        if (!ownsGlobals()) throw new Error('Analytics ownership changed');
        dispatching = true;
        try {
          queueFunction!.apply(host, command);
        } finally {
          dispatching = false;
        }
        if (command[0] === 'event' && !requested) {
          requested = true;
          const script = doc.createElement('script');
          script.async = true;
          script.referrerPolicy = 'no-referrer';
          script.src = 'https://www.googletagmanager.com/gtag/js?id=' + runtime.measurementId;
          script.addEventListener('error', failClosed, { once: true });
          // Denied/default, sanitized settings, config and the first event are already queued.
          loader(script);
          if (!ownsGlobals()) throw new Error('Analytics ownership changed while loading');
        }
      } catch {
        failClosed();
        throw new Error('Analytics document unavailable');
      }
    },
  });

  function onContact(event: Event) {
    if (!active || failed) return;
    const mouse = event as MouseEvent;
    if (!(
      (event.type === 'click' && mouse.button === 0) ||
      (event.type === 'auxclick' && mouse.button === 1)
    ))
      return;
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== 'function') return;
    const anchor = target.closest('a[data-analytics-purpose]');
    if (!anchor || anchor.ownerDocument !== doc) return;
    const purpose = anchor.getAttribute('data-analytics-purpose');
    if (purpose !== 'email' && purpose !== 'linkedin' && purpose !== 'resume') return;
    const completion = active;
    // Run after propagation so later native/React handlers can cancel the default action.
    queueMicrotask(() => {
      if (
        failed ||
        active !== completion ||
        event.defaultPrevented ||
        wasAnalyticsContactHandled(event)
      )
        return;
      session.trackContact(purpose as AnalyticsContactPurpose, completion.context);
    });
  }

  return {
    matches(measurementId, siteOrigin, incomingLoader) {
      return (
        runtime.measurementId === measurementId &&
        runtime.siteOrigin === siteOrigin &&
        loader === incomingLoader
      );
    },
    activate(context) {
      if (failed) return noop;
      const token = Symbol();
      active = { token, context };
      if (!listening) {
        doc.addEventListener('click', onContact);
        doc.addEventListener('auxclick', onContact);
        listening = true;
      }
      session.completeNavigation(context);
      return () => {
        if (active?.token === token) exclude();
      };
    },
    exclude,
    failClosed,
  };
}

/**
 * Default production behavior deliberately has NO executable Google loader.
 * Activation and future SDK-byte review remain separate approvals; the public
 * release flag cannot bypass this fail-closed guard. A captured loader may be injected
 * for offline SDK inspection, never to enable Analytics in a synthetic environment.
 */
export function mountDocumentAnalytics({
  document: doc,
  runtime,
  context,
  loadScript = null,
}: DocumentAnalyticsInput): () => void {
  const existing = documents.get(doc);
  const safeContext = publicAnalyticsContextSchema.safeParse(context);
  const config = analyticsTransportConfigSchema.safeParse({
    measurementId: runtime.measurementId,
    siteOrigin: runtime.siteOrigin,
  });
  if (
    !canMeasure(runtime) ||
    runtime.publicSiteEnabled !== true ||
    !safeContext.success ||
    !config.success ||
    !loadScript
  ) {
    existing?.exclude();
    return noop;
  }
  // Unknown/ineffective policy never reaches globals, listeners or executable script.
  if (!hasRestrictedDevicePolicy(doc)) {
    existing?.failClosed();
    return noop;
  }
  if (existing) {
    if (!existing.matches(config.data.measurementId, config.data.siteOrigin, loadScript)) {
      existing.failClosed();
      return noop;
    }
    return existing.activate(safeContext.data);
  }
  const controller = createController(doc, { ...runtime, ...config.data }, loadScript);
  if (!controller) return noop;
  documents.set(doc, controller);
  return controller.activate(safeContext.data);
}

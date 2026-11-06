import { portfolioAnalyticsEventSchema } from '../contracts/event.schema';

export type GoogleWireEvent = Record<string, string>;
type CapturedCollect = { url: string; body?: string | null };
const invalid = () => new TypeError('Invalid captured Google collect request');

function part(text: string) {
  const result: GoogleWireEvent = {};
  for (const [key, value] of new URLSearchParams(text)) {
    if (Object.hasOwn(result, key)) throw invalid();
    result[key] = value;
  }
  return result;
}

/** Offline capture decoder. It never executes SDK bytes or performs a request. */
export function decodeGoogleCollectRequest(request: CapturedCollect): GoogleWireEvent[] {
  const url = URL.parse(request.url);
  if (
    !url ||
    url.protocol !== 'https:' ||
    !/^(?:(?:www|region\d+)\.)?google-analytics\.com$/.test(url.hostname) ||
    url.pathname !== '/g/collect' ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    request.url.length > 131_072 ||
    (request.body?.length ?? 0) > 131_072
  )
    throw invalid();
  const shared = part(url.search.slice(1));
  const lines = request.body?.trim().split(/\r?\n/).filter(Boolean) ?? [];
  return lines.length ? lines.map((line) => ({ ...shared, ...part(line) })) : [shared];
}

/** Compares the approved event/context sequence, without treating SDK fields as approved. */
export function inspectGoogleEventSequence(options: {
  wire: readonly GoogleWireEvent[];
  expected: readonly { name: string; locale: string; pagePath: string }[];
  origin: string;
  measurementId: string;
}) {
  const { wire, expected, origin, measurementId } = options;
  const violations = new Set<string>();
  const observed: { name: string; locale: string; pagePath: string }[] = [];
  for (const event of wire) {
    if (event.tid !== measurementId) violations.add('measurement-target-mismatch');
    if (event.uid) violations.add('user-id-present');
    if (event.dt || event.dr) violations.add('nonempty-title-or-referrer');
    const page = URL.parse(event.dl ?? '');
    const pagePath = page?.pathname ?? '';
    if (
      !page ||
      page.origin !== origin ||
      page.username ||
      page.password ||
      page.search ||
      page.hash
    )
      violations.add('noncanonical-page-context');
    const parsed = portfolioAnalyticsEventSchema.safeParse({
      name: event.en,
      locale: event.ul,
      pagePath,
    });
    if (!parsed.success) violations.add('unapproved-event');
    else observed.push(parsed.data);
  }
  if (JSON.stringify(observed) !== JSON.stringify(expected))
    violations.add('event-sequence-mismatch');
  return {
    expectedEvents: expected.length,
    observedEvents: wire.length,
    matches: violations.size === 0,
    violations: [...violations],
  };
}

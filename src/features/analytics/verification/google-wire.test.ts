import { describe, expect, it } from 'vitest';
import { decodeGoogleCollectRequest, inspectGoogleEventSequence } from './google-wire';

const origin = 'https://portfolio.example.invalid';
const measurementId = 'G-TESTONLY1';
const request = (query = '', body?: string) => ({
  url: `https://www.google-analytics.com/g/collect?v=2&tid=${measurementId}&dl=${encodeURIComponent(origin + '/en')}&ul=en${query}`,
  body,
});
const expected = [{ name: 'page_view', locale: 'en', pagePath: '/en' }] as const;

describe('Google wire inspection without executing or forwarding requests', () => {
  it('decodes a query-only event', () => {
    expect(decodeGoogleCollectRequest(request('&en=page_view'))).toMatchObject([
      { en: 'page_view', dl: origin + '/en', ul: 'en', tid: measurementId },
    ]);
  });
  it('decodes each newline batch event over the shared query context', () => {
    const events = decodeGoogleCollectRequest(
      request(
        '',
        'en=page_view\nen=resume_open&dl=' + encodeURIComponent(origin + '/pt') + '&ul=pt',
      ),
    );
    expect(events.map((event) => [event.en, event.dl, event.ul])).toEqual([
      ['page_view', origin + '/en', 'en'],
      ['resume_open', origin + '/pt', 'pt'],
    ]);
  });
  it.each([
    'http://www.google-analytics.com/g/collect',
    'https://www.google-analytics.com.evil.invalid/g/collect',
    'https://user:password@www.google-analytics.com/g/collect',
    'https://www.google-analytics.com/other',
  ])('refuses an unknown or credentialed endpoint: %s', (url) => {
    expect(() => decodeGoogleCollectRequest({ url })).toThrow();
  });
  it('does not silently reinterpret repeated parameters within the same part', () => {
    expect(() => decodeGoogleCollectRequest(request('&en=page_view&en=resume_open'))).toThrow();
    expect(() => decodeGoogleCollectRequest(request('', 'en=page_view&en=resume_open'))).toThrow();
  });
  it('refuses unbounded capture input', () => {
    expect(() => decodeGoogleCollectRequest(request('', 'x'.repeat(131_073)))).toThrow();
  });
  it('accepts only the exact expected approved event sequence and canonical context', () => {
    const wire = decodeGoogleCollectRequest(request('&en=page_view'));
    expect(inspectGoogleEventSequence({ wire, expected, origin, measurementId })).toEqual({
      expectedEvents: 1,
      observedEvents: 1,
      matches: true,
      violations: [],
    });
  });
  it('reports an extra page view even when its name and URL are individually approved', () => {
    const event = decodeGoogleCollectRequest(request('&en=page_view'))[0];
    expect(
      inspectGoogleEventSequence({ wire: [event, event], expected, origin, measurementId }),
    ).toMatchObject({ matches: false, observedEvents: 2, violations: ['event-sequence-mismatch'] });
  });
  it('reports a core automatic event outside the approved four', () => {
    const wire = decodeGoogleCollectRequest(request('&en=user_engagement'));
    expect(
      inspectGoogleEventSequence({ wire, expected, origin, measurementId }).violations,
    ).toContain('unapproved-event');
  });
  it('reports raw URL queries, identifiers and private text without returning their values', () => {
    const wire = decodeGoogleCollectRequest(request('&en=page_view&uid=synthetic-user&dt=Private'));
    wire[0].dl += '?token=synthetic-private-token';
    const result = inspectGoogleEventSequence({ wire, expected, origin, measurementId });
    expect(result.matches).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        'noncanonical-page-context',
        'user-id-present',
        'nonempty-title-or-referrer',
      ]),
    );
    expect(JSON.stringify(result)).not.toContain('synthetic-private-token');
    expect(JSON.stringify(result)).not.toContain('synthetic-user');
  });
  it('reports a different measurement target', () => {
    const wire = decodeGoogleCollectRequest(request('&en=page_view'));
    wire[0].tid = 'G-OTHER123';
    expect(
      inspectGoogleEventSequence({ wire, expected, origin, measurementId }).violations,
    ).toContain('measurement-target-mismatch');
  });
});

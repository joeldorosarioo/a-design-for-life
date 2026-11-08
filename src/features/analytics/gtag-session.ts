import { createAnalyticsSession, type AnalyticsRuntime } from './analytics-session';
import type { Locale } from '@/helpers/i18n/locale.schema';
import type { PortfolioAnalyticsEvent } from './contracts/event.schema';

type GtagPageContext = {
  page_location: string;
  page_referrer: '';
  page_title: '';
  language: Locale;
};
type GtagPrivacyDefaults = GtagPageContext & {
  ignore_referrer: true;
  ads_data_redaction: true;
  url_passthrough: false;
  allow_google_signals: false;
  allow_ad_personalization_signals: false;
};
export type GtagCommand =
  | [
      'consent',
      'default',
      {
        analytics_storage: 'denied';
        ad_storage: 'denied';
        ad_user_data: 'denied';
        ad_personalization: 'denied';
      },
    ]
  | ['set', GtagPrivacyDefaults | (GtagPageContext & { ignore_referrer: true })]
  | ['js', Date]
  | ['config', string, { send_page_view: false }]
  | ['event', PortfolioAnalyticsEvent['name'], GtagPageContext & { send_to: string }];
export type GtagDispatch = (...command: GtagCommand) => void;

/**
 * Dormant command adapter. This does not create a script, dataLayer, global function,
 * request, cookie or alternate identifier. Only the outbound dispatch is injected.
 * A real Google loader still requires composition, property and wire verification.
 */
export function createGtagSession({
  runtime,
  dispatch,
}: {
  runtime: AnalyticsRuntime;
  dispatch: GtagDispatch;
}) {
  return createAnalyticsSession({
    runtime,
    createTransport({ measurementId, siteOrigin }) {
      let initialized = false;
      return {
        send(event) {
          const page: GtagPageContext = {
            page_location: siteOrigin + event.pagePath,
            page_referrer: '',
            page_title: '',
            language: event.locale,
          };
          if (!initialized) {
            initialized = true;
            dispatch('consent', 'default', {
              analytics_storage: 'denied',
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
            });
            dispatch('set', {
              ads_data_redaction: true,
              url_passthrough: false,
              allow_google_signals: false,
              allow_ad_personalization_signals: false,
              ...page,
              ignore_referrer: true,
            });
            dispatch('js', new Date());
            dispatch('config', measurementId, { send_page_view: false });
          } else {
            // Suppress SDK defaults of raw document URL/referrer/title on later events too.
            dispatch('set', { ...page, ignore_referrer: true });
          }
          dispatch('event', event.name, { send_to: measurementId, ...page });
        },
      };
    },
  });
}

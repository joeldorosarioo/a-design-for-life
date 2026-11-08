'use client';
import type { ComponentPropsWithRef } from 'react';
import type { AnalyticsContactPurpose } from '../contracts/event.schema';
import { usePublicAnalytics } from './analytics-provider';
import { markAnalyticsContact } from '../browser/contact-event-ownership';

export type TrackedLinkProps = ComponentPropsWithRef<'a'> & {
  purpose: AnalyticsContactPurpose;
  href: string;
};

/** href/children stay in the anchor; only the fixed purpose and safe page context are measured. */
export function TrackedLink({ purpose, onClick, onAuxClick, ...props }: TrackedLinkProps) {
  const analytics = usePublicAnalytics();
  return (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && event.button === 0) {
          if (analytics) {
            markAnalyticsContact(event.nativeEvent);
            analytics.session.trackContact(purpose, analytics.context);
          }
        }
      }}
      onAuxClick={(event) => {
        onAuxClick?.(event);
        if (!event.defaultPrevented && event.button === 1) {
          if (analytics) {
            markAnalyticsContact(event.nativeEvent);
            analytics.session.trackContact(purpose, analytics.context);
          }
        }
      }}
    />
  );
}

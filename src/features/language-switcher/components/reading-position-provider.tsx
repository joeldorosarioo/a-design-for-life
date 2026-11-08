'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import type {
  LanguageToggleProps,
  ReadingPage,
  TranslatedDestination,
} from '../contracts/language-control.schema';
import type { ReadingAnchor } from '../contracts/reading-anchor.schema';
import { captureReadingAnchor, restoreReadingAnchor } from '../helpers/reading-position';

type Transfer = {
  source: ReadingPage;
  targetLocale: 'pt' | 'en';
  destination: TranslatedDestination;
  anchor: ReadingAnchor | null;
  labels: LanguageToggleProps['labels'];
  controller: AbortController;
  cleanup: () => void;
  owner: object;
  phase: 'saving' | 'navigating' | 'restoring';
};
type TabSession = {
  transfer: Transfer | null;
  committed: ReadingPage | null;
  notice: string | null;
  listeners: Set<() => void>;
};
// Locale layouts are distinct router instances. Keep at most one short-lived
// transfer in this document, without persisting it or touching Document in SSR.
const sessions = new WeakMap<Document, TabSession>();
function tabSession(): TabSession {
  let session = sessions.get(document);
  if (!session) {
    session = { transfer: null, committed: null, notice: null, listeners: new Set() };
    sessions.set(document, session);
  }
  return session;
}
function publish(session: TabSession) {
  for (const listener of session.listeners) listener();
}
type ReadingContextValue = {
  pending: boolean;
  begin: (props: LanguageToggleProps) => Promise<void>;
  register: (page: ReadingPage) => void;
};
const ReadingContext = createContext<ReadingContextValue | null>(null);
function samePage(a: ReadingPage, b: ReadingPage) {
  return (
    a.locale === b.locale &&
    a.sourcePage.kind === b.sourcePage.kind &&
    (a.sourcePage.kind !== 'case' ||
      (b.sourcePage.kind === 'case' && a.sourcePage.caseId === b.sourcePage.caseId))
  );
}
export function ReadingPositionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const owner = useRef<object>({});
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const finish = useCallback((transfer: Transfer, message: string | null = null) => {
    const session = tabSession();
    if (session.transfer !== transfer) return;
    session.transfer = null;
    session.notice = message;
    transfer.cleanup();
    transfer.controller.abort();
    publish(session);
  }, []);
  useEffect(() => {
    const session = tabSession();
    const currentOwner = owner.current;
    const update = () => {
      setPending(Boolean(session.transfer));
      setNotice(session.notice);
    };
    session.listeners.add(update);
    update();
    return () => {
      session.listeners.delete(update);
      const transfer = session.transfer;
      // A navigation owns its existing cancellation listeners and 15s deadline
      // until the destination claims it. Saving/restoring cannot outlive its UI.
      if (transfer?.owner === currentOwner && transfer.phase !== 'navigating') finish(transfer);
    };
  }, [finish]);
  const register = useCallback(
    (page: ReadingPage) => {
      document.documentElement.lang = page.locale;
      const session = tabSession();
      const previous = session.committed;
      session.committed = page;
      const transfer = session.transfer;
      if (!transfer) {
        if (previous && !samePage(previous, page)) {
          session.notice = null;
          publish(session);
        }
        return;
      }
      if ((page.status ?? 200) !== 200) {
        finish(transfer);
        return;
      }
      if (transfer.phase === 'saving' && samePage(transfer.source, page)) return;
      const expected =
        transfer.destination.kind === 'case-missing'
          ? { kind: 'cases' as const }
          : transfer.source.sourcePage;
      if (
        !samePage(page, {
          locale: transfer.targetLocale,
          sourcePage: expected,
          pathname: transfer.destination.href,
        })
      ) {
        finish(transfer);
        return;
      }
      if (transfer.phase === 'restoring') return;
      if (transfer.phase !== 'navigating') {
        finish(transfer);
        return;
      }
      transfer.owner = owner.current;
      transfer.phase = 'restoring';
      void restoreReadingAnchor(
        transfer.destination.kind === 'case-missing' ? null : transfer.anchor,
        { signal: transfer.controller.signal },
      )
        .then((result) => {
          if (result.cancelled) return;
          finish(
            transfer,
            result.clamped || result.timedOut
              ? transfer.labels.failure
              : transfer.destination.kind === 'case-missing'
                ? transfer.labels.caseMissing
                : result.adjusted
                  ? transfer.labels.readingPositionAdjusted
                  : null,
          );
        })
        .catch(() => finish(transfer, transfer.labels.failure));
    },
    [finish],
  );
  const begin = useCallback(
    async (props: LanguageToggleProps) => {
      const session = tabSession();
      if (session.transfer || props.destination.kind === 'unavailable') return;
      const targetLocale = props.locale === 'pt' ? 'en' : 'pt';
      const destination = new URL(props.destination.href, window.location.origin);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname.split('/')[1] !== targetLocale ||
        destination.search ||
        destination.hash
      ) {
        session.notice = props.labels.failure;
        publish(session);
        return;
      }
      const transfer: Transfer = {
        source: {
          locale: props.locale,
          sourcePage: props.sourcePage,
          pathname: props.pathname,
          status: props.status,
        },
        targetLocale,
        destination: props.destination,
        anchor: (props.status ?? 200) === 200 ? captureReadingAnchor() : null,
        labels: props.labels,
        controller: new AbortController(),
        cleanup: () => {},
        phase: 'saving',
        owner: owner.current,
      };
      session.transfer = transfer;
      session.notice = null;
      publish(session);
      const cancel = () => finish(transfer);
      const userInput = (event: Event) => {
        const own =
          event.target instanceof Element && event.target.closest('[data-language-toggle]');
        if (
          own &&
          (event.type !== 'keydown' || ['Enter', ' '].includes((event as KeyboardEvent).key))
        )
          return;
        cancel();
      };
      const timer = setTimeout(() => finish(transfer, props.labels.failure), 15_000);
      window.addEventListener('popstate', cancel);
      for (const name of ['pointerdown', 'touchstart', 'wheel', 'keydown'])
        window.addEventListener(name, userInput, { passive: true });
      transfer.cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener('popstate', cancel);
        for (const name of ['pointerdown', 'touchstart', 'wheel', 'keydown'])
          window.removeEventListener(name, userInput);
      };
      try {
        const response = await fetch('/language-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: targetLocale }),
          credentials: 'same-origin',
          signal: transfer.controller.signal,
        });
        if (session.transfer !== transfer || transfer.controller.signal.aborted) return;
        if (response.status !== 204) throw new Error('Preference unavailable.');
        transfer.phase = 'navigating';
        router.push(transfer.destination.href, { scroll: false });
      } catch {
        if (session.transfer === transfer) finish(transfer, props.labels.failure);
      }
    },
    [finish, router],
  );
  const value = useMemo(() => ({ pending, begin, register }), [pending, begin, register]);
  return (
    <ReadingContext.Provider value={value}>
      {children}
      <Alert
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          notice ? 'fixed end-6 bottom-6 z-[60] max-w-[min(calc(100vw-3rem),32rem)]' : 'sr-only'
        }
      >
        {notice && <p>{notice}</p>}
      </Alert>
    </ReadingContext.Provider>
  );
}
export function useReadingPosition() {
  const value = useContext(ReadingContext);
  if (!value) throw new Error('LanguageToggle requires the persistent ReadingPositionProvider.');
  return value;
}

import { readingAnchorSchema, type ReadingAnchor } from '../contracts/reading-anchor.schema';

export function readingLine(): number {
  const header = document.querySelector<HTMLElement>('[data-portfolio-header]');
  return Math.max(0, header?.getBoundingClientRect().bottom ?? 0) + 24;
}
function useful(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Boolean(element.textContent?.trim() || element.querySelector('img'))
  );
}
function candidates() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      'main[data-reading-key], main [data-reading-key], footer[data-reading-key], footer [data-reading-key]',
    ),
  ).filter(useful);
}
function byStart(a: HTMLElement, b: HTMLElement) {
  const difference = a.getBoundingClientRect().top - b.getBoundingClientRect().top;
  return difference || (a.contains(b) ? 1 : b.contains(a) ? -1 : 0);
}
export function captureReadingAnchor(): ReadingAnchor | null {
  const line = readingLine();
  const visible = candidates().filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > line && rect.top < window.innerHeight;
  });
  // Prefer a nearby visible section start; a mostly-scrolled-out parent must not
  // mask the section the reader can actually see beneath the sticky Header.
  const upcoming = visible
    .filter((element) => {
      const top = element.getBoundingClientRect().top;
      return top >= line && top <= line + 160;
    })
    .sort(byStart);
  const containing = visible
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top <= line && rect.bottom > line;
    })
    .sort((a, b) =>
      a.contains(b)
        ? 1
        : b.contains(a)
          ? -1
          : b.getBoundingClientRect().top - a.getBoundingClientRect().top,
    );
  const element = upcoming[0] ?? containing[0] ?? visible.sort(byStart)[0];
  if (!element) return null;
  const ancestors: string[] = [];
  for (
    let parent = element.parentElement;
    parent && ancestors.length < 32;
    parent = parent.parentElement
  ) {
    const key = parent.dataset.readingKey;
    if (key) ancestors.push(key);
  }
  const result = readingAnchorSchema.safeParse({
    key: element.dataset.readingKey,
    top: element.getBoundingClientRect().top,
    ancestors,
  });
  return result.success ? result.data : null;
}
export function readingTarget(anchor: ReadingAnchor): {
  element: HTMLElement | null;
  adjusted: boolean;
} {
  const parsed = readingAnchorSchema.safeParse(anchor);
  if (!parsed.success) return { element: null, adjusted: true };
  const all = candidates();
  const exact = all.find((element) => element.dataset.readingKey === parsed.data.key);
  if (exact) return { element: exact, adjusted: false };
  for (const key of parsed.data.ancestors) {
    const ancestor = all.find((element) => element.dataset.readingKey === key);
    if (ancestor) return { element: ancestor, adjusted: true };
  }
  return { element: null, adjusted: true };
}

function frame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
function imageReady(image: HTMLImageElement, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', failed);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const loaded = () => {
      void image
        .decode()
        .catch(() => undefined)
        .then(() => {
          // A responsive candidate may change even after load. A rejected decode
          // while incomplete is not readiness; keep listening for its replacement.
          if (image.complete) finish();
        });
    };
    const failed = () => {
      if (image.complete) finish();
    };
    image.addEventListener('load', loaded);
    image.addEventListener('error', failed);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
    else if (image.complete) loaded();
  });
}
function ready(element: HTMLElement | null, signal: AbortSignal, timeoutMs: number) {
  const images = Array.from(document.images).filter((image) => {
    const rect = image.getBoundingClientRect();
    return (
      !image.complete &&
      rect.top < (element?.getBoundingClientRect().bottom ?? window.innerHeight) &&
      (image.loading !== 'lazy' || (rect.bottom > readingLine() && rect.top < window.innerHeight))
    );
  });
  const resources = new AbortController();
  const work = [
    document.fonts?.ready ?? Promise.resolve(),
    ...images.map((image) => imageReady(image, resources.signal)),
  ];
  return new Promise<boolean>((resolve) => {
    let closed = false;
    const finish = (timedOut: boolean) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      resources.abort();
      resolve(timedOut);
    };
    const cancel = () => finish(false);
    const timer = setTimeout(() => finish(true), timeoutMs);
    signal.addEventListener('abort', cancel, { once: true });
    void Promise.allSettled(work).then(() => finish(false));
    if (signal.aborted) cancel();
  });
}
export async function restoreReadingAnchor(
  anchor: ReadingAnchor | null,
  { signal, timeoutMs = 8_000 }: { signal: AbortSignal; timeoutMs?: number },
): Promise<{ adjusted: boolean; clamped: boolean; cancelled: boolean; timedOut: boolean }> {
  let target = anchor ? readingTarget(anchor) : { element: null, adjusted: false };
  let queued = false;
  let closed = false;
  const correct = () => {
    if (signal.aborted || closed) return;
    target = anchor ? readingTarget(anchor) : target;
    if (!target.element) window.scrollTo({ top: 0, behavior: 'instant' });
    else
      window.scrollBy({
        top:
          target.element.getBoundingClientRect().top -
          (target.adjusted ? readingLine() : anchor!.top),
        behavior: 'instant',
      });
  };
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          if (queued || signal.aborted) return;
          queued = true;
          requestAnimationFrame(() => {
            queued = false;
            correct();
          });
        });
  const main = document.querySelector('main');
  if (main) observer?.observe(main);
  if (target.element) observer?.observe(target.element);
  try {
    correct();
    const timedOut = await ready(target.element, signal, timeoutMs);
    if (!signal.aborted && !timedOut) {
      await frame();
      correct();
      await frame();
      correct();
    }
    const expectedTop = target.adjusted ? readingLine() : (anchor?.top ?? 0);
    const error = target.element
      ? Math.abs(target.element.getBoundingClientRect().top - expectedTop)
      : Math.abs(window.scrollY);
    return {
      adjusted: target.adjusted,
      clamped: !signal.aborted && error > 2,
      cancelled: signal.aborted,
      timedOut,
    };
  } finally {
    closed = true;
    observer?.disconnect();
  }
}

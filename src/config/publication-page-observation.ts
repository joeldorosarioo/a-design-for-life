import 'server-only';
import { parse, type DefaultTreeAdapterTypes as HTML } from 'parse5';

export type PublicPageObservation = {
  locale: 'pt' | 'en';
  section?: string;
  heading?: string | null;
  canonical?: string;
  alternates?: Readonly<Record<string, string>>;
  cards?: readonly { id: string; path: string; title: string | null }[];
};

function attribute(element: HTML.Element, name: string) {
  return element.attrs.find((item) => item.name === name)?.value;
}

function isInert(element: HTML.Element): boolean {
  return (
    ['script', 'style', 'template'].includes(element.tagName) ||
    attribute(element, 'hidden') !== undefined
  );
}

function elements(root: HTML.ParentNode): HTML.Element[] {
  const result: HTML.Element[] = [];
  const pending = [...root.childNodes].reverse();
  while (pending.length) {
    const node = pending.pop()!;
    if (!('tagName' in node)) continue;
    result.push(node);
    if (!isInert(node)) {
      for (let index = node.childNodes.length - 1; index >= 0; index--)
        pending.push(node.childNodes[index]!);
    }
  }
  return result;
}

function text(root: HTML.Element): string {
  const values: string[] = [];
  const pending = [...root.childNodes].reverse();
  while (pending.length) {
    const node = pending.pop()!;
    if ('value' in node) values.push(node.value);
    if ('tagName' in node && !isInert(node)) {
      for (let index = node.childNodes.length - 1; index >= 0; index--)
        pending.push(node.childNodes[index]!);
    }
  }
  return normalize(values.join(''));
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function matchesCards(
  section: HTML.Element,
  expected: NonNullable<PublicPageObservation['cards']>,
) {
  const cards = elements(section).filter((element) =>
    attribute(element, 'data-reading-key')?.startsWith('case-card:'),
  );
  return (
    cards.length === expected.length &&
    cards.every((card, index) => {
      const selected = expected[index]!;
      if (isInert(card) || attribute(card, 'data-reading-key') !== `case-card:${selected.id}`)
        return false;
      const descendants = elements(card);
      const heading = descendants.find(({ tagName }) => tagName === 'h2' || tagName === 'h3');
      if (!selected.title) return !heading;
      const anchor = heading && elements(heading).find(({ tagName }) => tagName === 'a');
      return (
        heading &&
        !isInert(heading) &&
        anchor &&
        !isInert(anchor) &&
        attribute(anchor, 'href') === selected.path &&
        text(anchor) === normalize(selected.title)
      );
    })
  );
}

export function matchesPublicPage(
  bytes: Uint8Array,
  headers: Headers,
  expected: PublicPageObservation,
): boolean {
  if (headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'text/html')
    return false;
  const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const document = parse(html, { sourceCodeLocationInfo: true });
  const nodes = elements(document);
  const root = nodes.find(({ tagName }) => tagName === 'html');
  if (!root?.sourceCodeLocation?.endTag || attribute(root, 'lang') !== expected.locale)
    return false;
  if (
    nodes.some((node) => node.tagName === 'template' && attribute(node, 'data-dgst') !== undefined)
  )
    return false;
  const main = nodes.filter(({ tagName }) => tagName === 'main');
  if (main.length !== 1 || isInert(main[0]!)) return false;
  const body = elements(main[0]!);
  const headings = body.filter(({ tagName }) => tagName === 'h1');
  if (expected.heading !== undefined) {
    const required = expected.heading === null ? [] : [normalize(expected.heading)];
    if (
      headings.length !== required.length ||
      headings.some((heading, index) => isInert(heading) || text(heading) !== required[index])
    )
      return false;
  }
  const section =
    expected.section === undefined
      ? main[0]!
      : body.find((element) => attribute(element, 'data-reading-key') === expected.section);
  if (!section || isInert(section) || (expected.cards && !matchesCards(section, expected.cards)))
    return false;
  const links = nodes.filter(({ tagName }) => tagName === 'link');
  if (expected.canonical !== undefined) {
    const canonicals = links.filter((element) => attribute(element, 'rel') === 'canonical');
    if (canonicals.length !== 1 || attribute(canonicals[0]!, 'href') !== expected.canonical)
      return false;
  }
  if (expected.alternates) {
    const alternates = links.filter(
      (element) =>
        attribute(element, 'rel') === 'alternate' && attribute(element, 'hreflang') !== undefined,
    );
    if (
      alternates.length !== Object.keys(expected.alternates).length ||
      Object.entries(expected.alternates).some(
        ([language, href]) =>
          !alternates.some(
            (element) =>
              attribute(element, 'hreflang') === language && attribute(element, 'href') === href,
          ),
      )
    )
      return false;
  }
  return true;
}

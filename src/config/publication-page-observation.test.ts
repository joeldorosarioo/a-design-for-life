import { expect, it } from 'vitest';
import { matchesPublicPage, type PublicPageObservation } from './publication-page-observation';

const origin = 'https://portfolio.example.invalid';
const cards = [
  { id: '30c37aab-6c5c-46d7-9ef3-52540e881ed5', path: '/pt/cases/um', title: 'Um & dois' },
  { id: '5e035cf5-c20c-4c9b-918b-5271b86fabcc', path: '/pt/cases/dois', title: 'Dois' },
];
const page: PublicPageObservation = {
  locale: 'pt',
  section: 'cases-list',
  heading: 'Projetos publicados',
  canonical: `${origin}/pt/cases`,
  alternates: { pt: `${origin}/pt/cases`, en: `${origin}/en/cases` },
  cards,
};
const htmlHeaders = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
const head = `
  <link rel="canonical" href="${origin}/pt/cases">
  <link rel="alternate" hrefLang="pt" href="${origin}/pt/cases">
  <link rel="alternate" hrefLang="en" href="${origin}/en/cases">`;
const card = ({ id, path, title }: (typeof cards)[number]) => `
  <article data-reading-key="case-card:${id}"><h2><a href="${path}">${title.replaceAll('&', '&amp;')}</a></h2></article>`;
const content = `
  <h1>Projetos <span>publicados</span></h1>
  <div data-reading-key="cases-list">${cards.map(card).join('')}</div>`;
const complete = (body = content, metadata = head) =>
  `<!doctype html><html lang="pt"><head>${metadata}</head><body><main id="main-content">${body}</main></body></html>`;
const match = (html: string, expected = page, headers = htmlHeaders) =>
  matchesPublicPage(Buffer.from(html), headers, expected);

it('matches rendered heading, cards in order and localized metadata with actual escaped text', () => {
  expect(match(complete())).toBe(true);
});

it('can verify an empty published list even if optional headline and alternate are absent', () => {
  const html = complete(
    '<div data-reading-key="cases-list"></div>',
    '<link rel="canonical" href="https://portfolio.example.invalid/pt/cases">',
  );
  expect(match(html, { ...page, cards: [], heading: null, alternates: {} })).toBe(true);
});

it.each([
  ['changed heading', complete(content.replace('publicados', 'antigos'))],
  ['wrong HTML locale', complete().replace('lang="pt"', 'lang="en"')],
  [
    'missing alternate',
    complete(content, head.replace(/<link rel="alternate" hrefLang="en"[^>]*>/, '')),
  ],
  ['wrong canonical', complete(content, head.replace('/pt/cases', '/en/cases'))],
  [
    'reordered cards',
    complete(content.replace(cards.map(card).join(''), [...cards].reverse().map(card).join(''))),
  ],
  ['wrong rendered card link', complete(content.replace('/pt/cases/um', '/pt/cases/outro'))],
  [
    'Next error template',
    complete(content + '<template data-dgst="NEXT_HTTP_ERROR_FALLBACK;500"></template>'),
  ],
  [
    'serialized RSC lookalike',
    complete(`<script>self.__next_f.push(${JSON.stringify(content)})</script>`),
  ],
  ['hidden fallback', complete(`<div hidden>${content}</div>`)],
])('refuses %s', (_name, html) => expect(match(html)).toBe(false));

it('refuses a wrong content type even when bytes contain otherwise matching HTML', () => {
  expect(match(complete(), page, new Headers({ 'Content-Type': 'application/json' }))).toBe(false);
});

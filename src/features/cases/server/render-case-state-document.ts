import 'server-only';
import type { CaseStatePresentation } from '../contracts/case-state-presentation.schema';
const stylesheet = '/_portfolio/case-state.css';
function escapeHTML(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}
/** Validated presentation only: this renderer accepts no Request, slug, Root or token. */
export function renderCaseStateDocument(presentation: CaseStatePresentation): string {
  const { locale, title, description, navigation: nav } = presentation;
  const english = locale === 'en';
  function link(href: string, label: string, newTab = false, className = '') {
    const announced = `${label} (${nav.controls.newTabLabel})`;
    return `<a href="${escapeHTML(href)}"${className ? ` class="${className}"` : ''}${newTab ? ` target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(announced)}"` : ''}>${escapeHTML(label)}${newTab ? `<span class="case-state-sr-only"> (${escapeHTML(nav.controls.newTabLabel)})</span>` : ''}</a>`;
  }
  const brand = () => link(nav.brand.href, nav.brand.label, false, 'case-state-brand');
  const items = nav.items
    .map(
      (item) =>
        `<li>${link(item.destination.href, item.label, item.destination.kind === 'resume')}</li>`,
    )
    .join('');
  const paragraph = (value: string | null | undefined, className: string) =>
    value ? `<p class="${className}">${escapeHTML(value)}</p>` : '';
  const footer = nav.footer;
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${escapeHTML(title)}</title><link rel="stylesheet" href="${stylesheet}"></head><body class="case-state-document"><a class="case-state-skip" href="#main-content">${english ? 'Skip to content' : 'Pular para o conteúdo'}</a><header class="case-state-header"><div class="case-state-container case-state-header-inner">${brand()}<nav aria-label="${english ? 'Main navigation' : 'Navegação principal'}"><ul class="case-state-navigation">${items}</ul></nav></div></header><main id="main-content" tabindex="-1" class="case-state-container case-state-main"><h1 class="case-state-title">${escapeHTML(title)}</h1>${paragraph(description, 'case-state-description')}<nav aria-label="${english ? 'Continue browsing' : 'Continue navegando'}"><ul class="case-state-links"><li>${link(nav.items[0].destination.href, nav.items[0].label, false, 'case-state-action')}</li><li>${link('#contact', nav.items[3].label, false, 'case-state-action')}</li></ul></nav></main><footer class="case-state-footer"><div class="case-state-container case-state-footer-inner">${paragraph(footer.eyebrow, 'case-state-footer-eyebrow')}${footer.title ? `<h2 class="case-state-footer-title">${escapeHTML(footer.title)}</h2>` : ''}${paragraph(footer.description, 'case-state-footer-description')}<ul id="contact" tabindex="-1" class="case-state-contacts" aria-label="${escapeHTML(nav.items[3].label)}"><li>${link(`mailto:${nav.contacts.email}`, footer.emailLabel, false, 'case-state-action')}</li><li>${link(nav.contacts.linkedin, footer.linkedinLabel, false, 'case-state-action')}</li><li>${link(nav.items[2].destination.href, footer.resumeLabel, true, 'case-state-action')}</li></ul><img class="case-state-divider" src="/figma/footer-divider.svg" width="1280" height="1" alt=""><div class="case-state-footer-meta">${brand()}${paragraph(footer.copyright, 'case-state-copyright')}</div></div></footer></body></html>`;
}

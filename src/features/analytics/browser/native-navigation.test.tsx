// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteHeader, SiteFooter } from '@/features/site-navigation/ui';
import { navigationEnFixture } from '../../../../testing/fixtures/content';
import { mountDocumentAnalytics, type AnalyticsHost } from './document-analytics';
const runtime = {
  environment: 'production',
  area: 'public',
  preview: false,
  publicSiteEnabled: true,
  measurementId: 'G-TESTONLY1',
  siteOrigin: 'https://portfolio.example.invalid',
};
const context = { locale: 'en', pagePath: '/en' } as const;
let frame: HTMLIFrameElement, owner: Document, host: AnalyticsHost, container: HTMLDivElement;
let release: () => void;
beforeEach(() => {
  frame = document.createElement('iframe');
  document.body.appendChild(frame);
  owner = frame.contentDocument!;
  Object.defineProperty(owner, 'featurePolicy', {
    configurable: true,
    value: { features: () => ['ch-ua-high-entropy-values'], allowsFeature: () => false },
  });
  host = frame.contentWindow! as AnalyticsHost;
  container = owner.createElement('div');
  owner.body.appendChild(container);
  vi.stubGlobal('document', owner);
  release = mountDocumentAnalytics({ document: owner, runtime, context, loadScript() {} });
});
afterEach(() => {
  release();
  cleanup();
  vi.unstubAllGlobals();
  frame.remove();
});
const events = () =>
  (host.dataLayer ?? []).map((entry) => Array.from(entry)).filter((entry) => entry[0] === 'event');

it('measures only the explicitly purposed header/footer native anchors without changing their destinations or tab behavior', async () => {
  render(
    <>
      <SiteHeader navigation={navigationEnFixture} />
      <SiteFooter navigation={navigationEnFixture} />
    </>,
    { container },
  );
  const nav = within(container.querySelector('header nav')! as HTMLElement);
  const headerResume = nav.getByRole('link', { name: 'Resume (opens in a new tab)' });
  expect(headerResume).toHaveAttribute(
    'href',
    '/media/00000000-0000-4000-8000-000000000002/original',
  );
  expect(headerResume).toHaveAttribute('target', '_blank');
  expect(headerResume).toHaveAttribute('rel', 'noopener noreferrer');
  const contacts = within(container.querySelector('#contact')! as HTMLElement);
  const email = contacts.getByRole('link', { name: 'Email' });
  const linkedin = contacts.getByRole('link', { name: 'LinkedIn' });
  const resume = contacts.getByRole('link', { name: 'Resume (opens in a new tab)' });
  expect(email).toHaveAttribute('data-analytics-purpose', 'email');
  expect(email).toHaveAttribute('href', 'mailto:en@example.invalid');
  expect(email).not.toHaveAttribute('target');
  expect(linkedin).toHaveAttribute('data-analytics-purpose', 'linkedin');
  expect(linkedin).toHaveAttribute('href', 'https://www.linkedin.com/in/synthetic-en');
  expect(linkedin).not.toHaveAttribute('target');
  expect(resume).toHaveAttribute('data-analytics-purpose', 'resume');
  fireEvent.click(headerResume);
  fireEvent.click(resume);
  await Promise.resolve();
  expect(events().map((entry) => entry[1])).toEqual(['page_view', 'resume_open', 'resume_open']);
  expect(
    Array.from(container.querySelectorAll('[data-analytics-purpose]')).map((node) =>
      node.getAttribute('data-analytics-purpose'),
    ),
  ).toEqual(['resume', 'email', 'linkedin', 'resume']);
});

it('keeps the real mobile resume action measurable while the menu closes with its native new-tab contract', async () => {
  const user = userEvent.setup({ document: owner });
  render(<SiteHeader navigation={navigationEnFixture} />, { container });
  await user.click(within(container).getByRole('button', { name: 'Open menu' }));
  const dialog = within(owner.body).getByRole('dialog', { name: 'Main navigation' });
  const resume = within(dialog).getByRole('link', { name: 'Resume (opens in a new tab)' });
  expect(resume).toHaveAttribute('href', '/media/00000000-0000-4000-8000-000000000002/original');
  expect(resume).toHaveAttribute('target', '_blank');
  expect(resume).toHaveAttribute('rel', 'noopener noreferrer');
  expect(resume).toHaveAttribute('data-analytics-purpose', 'resume');
  await user.click(resume);
  expect(within(owner.body).queryByRole('dialog')).toBeNull();
  expect(events().map((entry) => entry[1])).toEqual(['page_view', 'resume_open']);
});

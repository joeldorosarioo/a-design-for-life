// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigationEnFixture, navigationPtFixture } from '../../../../testing/fixtures/content';
import { MobileMenu } from './mobile-menu';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// If the menu cannot open from the keyboard, none of its destinations are accessible.
it('opens from the keyboard with four normal navigation links', async () => {
  const user = userEvent.setup();
  render(
    <MobileMenu
      items={navigationPtFixture.items}
      controls={navigationPtFixture.controls}
      navigationLabel="Navegação principal"
    />,
  );
  await user.tab();
  expect(screen.queryByRole('button', { name: 'Abrir menu' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveFocus();
  await user.keyboard('{Enter}');
  const dialog = screen.getByRole('dialog', { name: 'Navegação principal' });
  expect(
    within(dialog)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href')),
  ).toEqual([
    '/pt/cases',
    '/pt/sobre',
    '/media/00000000-0000-4000-8000-000000000001/original',
    '#contact',
  ]);
  expect(screen.getByRole('button', { name: 'Abrir menu', hidden: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

// Closing must not leave focus in removed overlay content.
it.each(['escape', 'close button'])('returns focus to the trigger after %s', async (method) => {
  const user = userEvent.setup();
  render(
    <MobileMenu
      items={navigationEnFixture.items}
      controls={navigationEnFixture.controls}
      navigationLabel="Main navigation"
    />,
  );
  expect(screen.queryByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Open menu' });
  await user.click(trigger);
  if (method === 'escape') await user.keyboard('{Escape}');
  else await user.click(screen.getByRole('button', { name: 'Close menu' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

// An uncontained tab cycle would expose background actions while the modal is open.
it('keeps keyboard focus inside the open menu', async () => {
  const user = userEvent.setup();
  render(
    <>
      <MobileMenu
        items={navigationPtFixture.items}
        controls={navigationPtFixture.controls}
        navigationLabel="Navegação principal"
      />
      <button>Outside</button>
    </>,
  );
  expect(screen.queryByRole('button', { name: 'Abrir menu' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
  const dialog = screen.getByRole('dialog');
  const links = within(dialog).getAllByRole('link');
  links[links.length - 1].focus();
  await user.tab();
  expect(within(dialog).getByRole('button', { name: 'Fechar menu' })).toHaveFocus();
});

// Contact must move focus to the current-page target after dismissing the modal.
it('closes contact navigation and focuses the contact target', async () => {
  const user = userEvent.setup();
  render(
    <>
      <MobileMenu
        items={navigationPtFixture.items}
        controls={navigationPtFixture.controls}
        navigationLabel="Navegação principal"
      />
      <ul id="contact" tabIndex={-1} aria-label="Contato">
        <li>
          <a href="mailto:pt@example.invalid">E-mail</a>
        </li>
      </ul>
    </>,
  );
  expect(screen.queryByRole('button', { name: 'Abrir menu' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Contato' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Contato' })).toHaveFocus();
});

// The mobile resume must carry the same locale and accessible new-tab contract.
it('keeps the English PDF and new-tab indication in the mobile menu', async () => {
  const user = userEvent.setup();
  render(
    <MobileMenu
      items={navigationEnFixture.items}
      controls={navigationEnFixture.controls}
      navigationLabel="Main navigation"
    />,
  );
  expect(screen.queryByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  const link = screen.getByRole('link', { name: 'Resume (opens in a new tab)' });
  expect(link).toHaveAttribute('href', '/media/00000000-0000-4000-8000-000000000002/original');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

// Keeping the modal open when its trigger is hidden would block the desktop page.
it('dismisses the mobile overlay when the viewport switches to desktop', async () => {
  const user = userEvent.setup();
  const query = Object.assign(new EventTarget(), {
    matches: false,
    media: '(min-width: 64rem)',
    onchange: null,
    addListener() {},
    removeListener() {},
  });
  vi.stubGlobal('matchMedia', () => query);
  render(
    <MobileMenu
      items={navigationPtFixture.items}
      controls={navigationPtFixture.controls}
      navigationLabel="Navegação principal"
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  act(() => {
    query.matches = true;
    query.dispatchEvent(new Event('change'));
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

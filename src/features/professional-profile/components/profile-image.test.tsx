// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProfileImage } from './profile-image';

afterEach(cleanup);
const image = {
  mediaId: '00000000-0000-4000-8000-000000000001',
  decorative: false,
  alt: 'Synthetic localized photograph description',
  caption: 'Synthetic localized photograph caption',
  storageUrl: 'https://private-storage.invalid/secret-original',
};

// Exposing raw media metadata or a source URL would bypass the protected media boundary.
it('uses the protected original ID route and only localized alt/caption', () => {
  const { container } = render(<ProfileImage image={image} kind="portrait" />);
  expect(
    screen.queryByRole('img', { name: 'Synthetic localized photograph description' }),
  ).toBeInTheDocument();
  const rendered = screen.getByRole('img');
  const url = new URL(rendered.getAttribute('src')!, 'http://localhost');
  expect(url.searchParams.get('url') ?? url.pathname).toBe(
    '/media/00000000-0000-4000-8000-000000000001/original',
  );
  expect(screen.getByText('Synthetic localized photograph caption').tagName).toBe('FIGCAPTION');
  expect(container.innerHTML).not.toContain('private-storage.invalid');
});

// An anonymous optimizer must never be asked to fetch an authenticated draft photo.
it('loads authenticated previews directly without a public optimizer URL', () => {
  render(<ProfileImage image={image} kind="desk" mediaMode="preview" />);
  expect(screen.queryByRole('img')).toHaveAttribute(
    'src',
    '/preview-media/00000000-0000-4000-8000-000000000001/original',
  );
  expect(screen.getByRole('img')).not.toHaveAttribute('srcset');
});

// Decorative classification must suppress an otherwise populated editorial alt.
it('keeps explicitly decorative photographs out of the accessible image list', () => {
  const { container } = render(
    <ProfileImage image={{ ...image, decorative: true, caption: null }} kind="architecture" />,
  );
  expect(container.querySelector('img')).toHaveAttribute('alt', '');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(container.querySelector('figcaption')).toBeNull();
});

it('omits a missing image instead of adding a placeholder or fabricated alt', () => {
  const { container } = render(<ProfileImage image={null} kind="portrait" />);
  expect(container).toBeEmptyDOMElement();
});

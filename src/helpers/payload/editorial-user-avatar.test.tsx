// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { EditorialUserAvatar } from './editorial-user-avatar';

const auth = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }));
vi.mock('@payloadcms/ui', () => ({ useAuth: () => ({ user: auth.user }) }));

afterEach(cleanup);
beforeEach(() => {
  auth.user = null;
});
const imageId = '11111111-1111-4111-8111-111111111111';
function expectPrivateSource(image: HTMLImageElement | null, id: string) {
  expect(image).not.toBeNull();
  const source = new URL(image!.getAttribute('src')!, window.location.href);
  expect(source.origin).toBe(window.location.origin);
  expect(source.pathname).toBe(`/preview-media/${id}/original`);
  expect(source.search).toBe('');
  expect(source.hash).toBe('');
}

it('loads an avatar only through authenticated same-origin media without the public optimizer', () => {
  auth.user = {
    name: 'Eliana Silva',
    avatar: { id: imageId, url: 'https://untrusted.example/avatar.jpg' },
  };
  const { container } = render(<EditorialUserAvatar />);
  const image = container.querySelector('img')!;
  expectPrivateSource(image, imageId);
  expect(image).toHaveAttribute('width', '32');
  expect(image).toHaveAttribute('height', '32');
  expect(image).toHaveAttribute('alt', '');
  expect(image.getAttribute('src')).not.toContain('/_next/image');
  expect(image.getAttribute('src')).not.toContain('untrusted');
});

it('supports an unpopulated upload relationship containing only its UUID', () => {
  auth.user = { avatar: imageId };
  const { container } = render(<EditorialUserAvatar />);
  expectPrivateSource(container.querySelector('img'), imageId);
});

it.each([
  'https://untrusted.example/avatar.jpg',
  '//untrusted.example/avatar.jpg',
  '../avatar.jpg',
  { id: '../../outside', url: 'https://untrusted.example/avatar.jpg' },
  { url: 'https://untrusted.example/avatar.jpg' },
])('refuses arbitrary avatar origins and invalid identifiers: %j', (avatar) => {
  auth.user = { name: 'João Dias', avatar };
  const { container } = render(<EditorialUserAvatar />);
  expect(container.querySelector('img')).toBeNull();
  expect(container).toHaveTextContent('JD');
});

it('replaces a failed private image with initials and retries a newly selected image', () => {
  auth.user = { name: 'João Dias', avatar: imageId };
  const { container, rerender } = render(<EditorialUserAvatar />);
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')).toBeNull();
  expect(container).toHaveTextContent('JD');
  const replacement = '22222222-2222-4222-8222-222222222222';
  auth.user = { ...auth.user, avatar: replacement };
  rerender(<EditorialUserAvatar />);
  expectPrivateSource(container.querySelector('img'), replacement);
});

it('uses initials without requiring an avatar or changing the public professional profile', () => {
  auth.user = { name: '  Érica  Dias  ', email: 'editor@example.invalid' };
  const { container } = render(<EditorialUserAvatar />);
  expect(container).toHaveTextContent('ÉD');
  expect(container.querySelector('img')).toBeNull();
});

it('falls back to the email initial for an existing account without a name', () => {
  auth.user = { email: 'editor@example.invalid' };
  const { container } = render(<EditorialUserAvatar />);
  expect(container).toHaveTextContent('E');
});

it('uses a local default icon when no account identity is available', () => {
  const { container } = render(<EditorialUserAvatar />);
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('svg')).toBeInTheDocument();
});

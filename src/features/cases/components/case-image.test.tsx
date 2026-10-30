// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { CaseImage } from './case-image';
import { CaseImagePair } from './case-image-pair';
afterEach(cleanup);
const image = {
  mediaId: '00000000-0000-4000-8000-000000000001',
  alt: 'Localized first image',
  decorative: false,
  caption: '<b>Literal caption</b>',
};

// Real Next.Image output proves the media boundary and reserved image slot without an image mock.
it('uses only the protected original, dimensions, sizes and literal caption', () => {
  const { container } = render(<CaseImage image={image} kind="cover" />);
  const img = screen.queryByRole('img', { name: 'Localized first image' });
  expect(img).toBeInTheDocument();
  const source = new URL(img!.getAttribute('src')!, 'http://localhost');
  expect(source.searchParams.get('url') ?? source.pathname).toBe(
    '/media/00000000-0000-4000-8000-000000000001/original',
  );
  expect(img).toHaveAttribute('width', '1280');
  expect(img).toHaveAttribute('height', '480');
  expect(img).toHaveAttribute('sizes', '(min-width: 1328px) 1280px, calc(100vw - 48px)');
  expect(screen.getByText('<b>Literal caption</b>').tagName).toBe('FIGCAPTION');
  expect(container.querySelector('b')).toBeNull();
});

it('bypasses the anonymous optimizer for protected previews and honors decorative classification', () => {
  const { container } = render(
    <CaseImage image={{ ...image, decorative: true }} mediaMode="preview" />,
  );
  expect(container.querySelector('img')).toHaveAttribute(
    'src',
    '/preview-media/00000000-0000-4000-8000-000000000001/original',
  );
  expect(container.querySelector('img')).toHaveAttribute('alt', '');
  expect(container.querySelector('img')).not.toHaveAttribute('srcset');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('keeps paired images and labels in editorial order with stable reading identity', () => {
  const { container } = render(
    <CaseImagePair
      block={{
        type: 'image-pair',
        readingKey: '00000000-0000-4000-8000-000000000003',
        presentation: 'pair',
        first: image,
        second: {
          ...image,
          mediaId: '00000000-0000-4000-8000-000000000002',
          alt: 'Localized second image',
          caption: null,
        },
        firstLabel: 'First label',
        secondLabel: 'Second label',
      }}
    />,
  );
  expect(screen.queryByRole('img', { name: 'Localized first image' })).toBeInTheDocument();
  expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual([
    'Localized first image',
    'Localized second image',
  ]);
  expect(
    screen.getByText('First label').compareDocumentPosition(screen.getByText('Second label')) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(container.firstElementChild).toHaveAttribute(
    'data-reading-key',
    '00000000-0000-4000-8000-000000000003',
  );
});

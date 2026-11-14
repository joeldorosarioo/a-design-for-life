import { expect, it } from 'vitest';
import { mapImageUse } from './map-image-use';
it('leva descrição/legenda do uso sem URL nem metadata do asset compartilhado', () => {
  const media = {
    id: '3a7f8848-b305-47dd-8781-368c8ee21e3a',
    url: 'https://private.example.invalid/image',
    filename: 'private-file.png',
    createdAt: '',
    updatedAt: '',
  };
  const pt = mapImageUse({
    media,
    alt: 'Synthetic PT description',
    caption: 'Synthetic PT caption',
    decorative: false,
  });
  const en = mapImageUse({ media, alt: 'Synthetic EN description', decorative: false });
  expect(pt).toEqual({
    mediaId: media.id,
    alt: 'Synthetic PT description',
    caption: 'Synthetic PT caption',
    decorative: false,
  });
  expect(en).toMatchObject({ mediaId: media.id, alt: 'Synthetic EN description' });
  expect(JSON.stringify([pt, en])).not.toContain('private.example');
});
it('não inventa recurso para uso ainda vazio', () => {
  expect(mapImageUse(null)).toBeUndefined();
});

it('projects only validated intrinsic dimensions from an authenticated populated image', () => {
  const media = {
    id: '3a7f8848-b305-47dd-8781-368c8ee21e3a',
    width: 600,
    height: 900,
    url: '/private-library-file',
    createdAt: '',
    updatedAt: '',
  };
  expect(mapImageUse({ media, alt: 'Portrait' })).toEqual({
    mediaId: media.id,
    alt: 'Portrait',
    decorative: false,
    caption: null,
    intrinsicSize: { width: 600, height: 900 },
  });
  for (const width of [0, -1, 1.5, null])
    expect(mapImageUse({ media: { ...media, width } })).not.toHaveProperty('intrinsicSize');
});

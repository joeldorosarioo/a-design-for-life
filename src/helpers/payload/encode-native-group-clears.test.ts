import { describe, expect, it } from 'vitest';
import type { Field } from 'payload';
import { encodeNativeGroupClears } from './encode-native-group-clears';

const imageFields: Field[] = [
  { name: 'media', type: 'upload', relationTo: 'media' },
  { name: 'decorative', type: 'checkbox', defaultValue: false },
  { name: 'alt', type: 'text' },
];
const fields: Field[] = [
  {
    name: 'seo',
    type: 'group',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'image', type: 'group', fields: imageFields },
      { name: 'rows', type: 'array', fields: [{ name: 'title', type: 'text' }] },
      { name: 'blocks', type: 'blocks', blocks: [] },
    ],
  },
];

describe('Native named-group clear encoding', () => {
  it('encodes an explicit null group into complete declared clear leaves', () => {
    expect(encodeNativeGroupClears({ seo: null }, fields)).toEqual({
      seo: {
        title: null,
        image: { media: null, decorative: false, alt: null },
        rows: [],
        blocks: [],
      },
    });
  });
  it('encodes only the nested group explicitly cleared, preserving partial input', () => {
    expect(encodeNativeGroupClears({ seo: { image: null } }, fields)).toEqual({
      seo: {
        image: { media: null, decorative: false, alt: null },
      },
    });
  });
  it('preserves omission, scalar/upload nulls and unknown data for the strict validator', () => {
    const input = {
      seo: { title: null, image: { media: null } },
      unknown: 'still rejected upstream',
    };
    expect(encodeNativeGroupClears(input, fields)).toEqual(input);
    expect(encodeNativeGroupClears({}, fields)).toEqual({});
  });
  it('visits groups inside declared array rows and each selected block type', () => {
    const nested: Field[] = [
      {
        name: 'rows',
        type: 'array',
        fields: [{ name: 'image', type: 'group', fields: imageFields }],
      },
      {
        name: 'sections',
        type: 'blocks',
        blocks: [
          { slug: 'picture', fields: [{ name: 'image', type: 'group', fields: imageFields }] },
        ],
      },
    ];
    const image = { media: null, decorative: false, alt: null };
    expect(
      encodeNativeGroupClears(
        { rows: [{ image: null }], sections: [{ blockType: 'picture', image: null }] },
        nested,
      ),
    ).toEqual({ rows: [{ image }], sections: [{ blockType: 'picture', image }] });
  });
  it('visits unnamed presentation containers without inventing a wrapper value', () => {
    const layout: Field[] = [
      { type: 'row', fields: [{ name: 'image', type: 'group', fields: imageFields }] },
    ];
    expect(encodeNativeGroupClears({ image: null }, layout)).toEqual({
      image: { media: null, decorative: false, alt: null },
    });
  });
  it('never mutates the caller data or field configuration', () => {
    const input = { seo: { image: null } };
    const originalFields = structuredClone(fields);
    encodeNativeGroupClears(input, fields);
    expect(input).toEqual({ seo: { image: null } });
    expect(fields).toEqual(originalFields);
  });
});

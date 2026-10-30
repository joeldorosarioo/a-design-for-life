// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { caseDetailDTOSchema } from '../contracts/case-dto.schema';
import { CaseDetail } from './case-detail';
afterEach(cleanup);
const rich = (text: string) => ({
  root: {
    type: 'root',
    direction: null,
    format: '',
    indent: 0,
    version: 1,
    children: [
      {
        type: 'paragraph',
        direction: null,
        format: '',
        indent: 0,
        version: 1,
        children: [
          { type: 'text', version: 1, text, detail: 0, format: 0, mode: 'normal', style: '' },
        ],
      },
    ],
  },
});
const image = {
  mediaId: '00000000-0000-4000-8000-000000000010',
  decorative: false,
  alt: 'Synthetic main cover',
  caption: null,
};
const detail = caseDetailDTOSchema.parse({
  caseId: '00000000-0000-4000-8000-000000000009',
  locale: 'en',
  eyebrow: 'Synthetic study eyebrow',
  title: 'Normal Emphasis',
  titleParts: { normal: 'Normal', emphasis: 'Emphasis' },
  summary: 'Listing-only summary',
  introduction: 'Detail opening introduction',
  path: '/en/cases/study',
  cover: image,
  role: 'Synthetic role',
  scope: 'Synthetic scope',
  contextNote: 'Literal <b>context</b> note\nNext line',
  sections: [
    {
      readingKey: '00000000-0000-4000-8000-000000000001',
      presentation: 'narrative',
      eyebrow: 'Context entry',
      heading: 'Context heading',
      description: 'Synthetic context introduction',
      note: null,
      blocks: [
        {
          type: 'text',
          readingKey: '00000000-0000-4000-8000-000000000002',
          eyebrow: null,
          heading: 'Narrative block heading',
          note: 'Narrative block note',
          content: rich('Narrative paragraph'),
        },
        {
          type: 'image',
          readingKey: '00000000-0000-4000-8000-000000000003',
          image: { ...image, alt: 'Single editorial image' },
        },
        {
          type: 'image-pair',
          readingKey: '00000000-0000-4000-8000-000000000004',
          presentation: 'pair',
          first: { ...image, alt: 'First paired image' },
          second: { ...image, alt: 'Second paired image' },
          firstLabel: null,
          secondLabel: null,
        },
      ],
    },
    {
      readingKey: '00000000-0000-4000-8000-000000000005',
      presentation: 'comparison',
      eyebrow: 'Compare entry',
      heading: 'Comparison heading',
      description: null,
      note: 'Supplied comparison limitation',
      blocks: [
        {
          type: 'text',
          readingKey: '00000000-0000-4000-8000-000000000006',
          eyebrow: 'Before',
          heading: 'Before heading',
          note: null,
          content: rich('Before paragraph'),
        },
        {
          type: 'text',
          readingKey: '00000000-0000-4000-8000-000000000007',
          eyebrow: 'After',
          heading: 'After heading',
          note: null,
          content: rich('After paragraph'),
        },
      ],
    },
  ],
  contents: [
    {
      readingKey: '00000000-0000-4000-8000-000000000099',
      label: 'Stale independent contents',
      anchor: 'wrong',
    },
  ],
  seo: { title: 'Private-to-metadata title', description: null, image: null },
});
const props = {
  caseDetail: detail,
  projectsHref: '/en/cases',
  labels: {
    back: 'Back to studies',
    contents: 'This study',
    role: 'Role',
    scope: 'Scope',
    newTab: 'opens new tab',
  },
  resolveLink: () => null,
};

// Dropping title emphasis, facts or authored notes would lose public case content.
it('presents opening, facts and all three block types with stable reading keys', () => {
  const { container } = render(<CaseDetail {...props} />);
  expect(screen.queryByRole('heading', { level: 1, name: 'Normal Emphasis' })).toBeInTheDocument();
  expect(screen.getByText('Emphasis').tagName).toBe('SPAN');
  expect(screen.getByRole('link', { name: 'Back to studies' })).toHaveAttribute(
    'href',
    '/en/cases',
  );
  expect(screen.getByText('Detail opening introduction')).toBeInTheDocument();
  expect(screen.queryByText('Listing-only summary')).not.toBeInTheDocument();
  expect(screen.getByText('Role').tagName).toBe('DT');
  expect(screen.getByText('Synthetic scope').tagName).toBe('DD');
  expect(screen.getByText('Literal <b>context</b> note Next line')).toBeInTheDocument();
  expect(container.querySelector('b')).toBeNull();
  expect(screen.getByText('Narrative paragraph').closest('[data-reading-key]')).toHaveAttribute(
    'data-reading-key',
    '00000000-0000-4000-8000-000000000002',
  );
  expect(
    screen.getByRole('heading', { name: 'Context heading' }).closest('section'),
  ).toHaveAttribute('data-reading-key', '00000000-0000-4000-8000-000000000001');
  expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual([
    'Synthetic main cover',
    'Single editorial image',
    'First paired image',
    'Second paired image',
  ]);
  expect(screen.queryByText('Private-to-metadata title')).not.toBeInTheDocument();
});

it('derives contents from effective sections and preserves their IDs when reordered', () => {
  const { rerender } = render(<CaseDetail {...props} />);
  const toc = screen.queryByRole('navigation', { name: 'This study' });
  expect(toc).toBeInTheDocument();
  expect(
    within(toc!)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href')),
  ).toEqual([
    '#section-00000000-0000-4000-8000-000000000001',
    '#section-00000000-0000-4000-8000-000000000005',
  ]);
  expect(screen.queryByText('Stale independent contents')).not.toBeInTheDocument();
  rerender(
    <CaseDetail {...props} caseDetail={{ ...detail, sections: [...detail.sections].reverse() }} />,
  );
  expect(
    within(screen.getByRole('navigation', { name: 'This study' }))
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Compare entry', 'Context entry']);
  expect(document.getElementById('section-00000000-0000-4000-8000-000000000001')).toHaveTextContent(
    'Context heading',
  );
});

// Before/after is a preset of the same text blocks, never an invented image or metric widget.
it('renders comparison as two text cards in editorial order with its limitation', () => {
  render(<CaseDetail {...props} />);
  const heading = screen.queryByRole('heading', { name: 'Comparison heading' });
  expect(heading).toBeInTheDocument();
  const comparison = heading!.closest('section')!;
  expect(
    within(comparison)
      .getAllByRole('heading', { level: 3 })
      .map((item) => item.textContent),
  ).toEqual(['Before heading', 'After heading']);
  expect(within(comparison).getByText('Before paragraph')).toBeInTheDocument();
  expect(within(comparison).getByText('After paragraph')).toBeInTheDocument();
  expect(within(comparison).getByText('Supplied comparison limitation')).toBeInTheDocument();
  expect(within(comparison).queryByRole('img')).not.toBeInTheDocument();
});

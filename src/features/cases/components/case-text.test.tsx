// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { richTextSchema } from '../contracts/rich-text.schema';
import { CaseText } from './case-text';
afterEach(cleanup);
const element = { direction: null, format: '', indent: 0, version: 1 };
const leaf = (text: string, format = 0) => ({
  type: 'text',
  version: 1,
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text,
});
const paragraph = (children: unknown[]) => ({ ...element, type: 'paragraph', children });
const content = (children: unknown[]) =>
  richTextSchema.parse({ root: { ...element, type: 'root', children } });

// Rendering raw HTML, flattening lists or losing emphasis would change the authored narrative.
it('renders escaped text, all emphasis combinations, soft breaks and nested lists', () => {
  const { container } = render(
    <CaseText
      newTabLabel="opens a tab"
      resolveLink={() => null}
      content={content([
        paragraph([
          leaf('<script>literal</script>'),
          { type: 'linebreak', version: 1 },
          leaf('Bold', 1),
          leaf('Italic', 2),
          leaf('Both', 3),
        ]),
        {
          ...element,
          type: 'list',
          listType: 'number',
          tag: 'ol',
          start: 3,
          children: [
            {
              ...element,
              type: 'listitem',
              value: 3,
              children: [
                leaf('Step three'),
                {
                  ...element,
                  type: 'list',
                  listType: 'bullet',
                  tag: 'ul',
                  start: 1,
                  children: [
                    { ...element, type: 'listitem', value: 1, children: [leaf('Nested point')] },
                  ],
                },
              ],
            },
          ],
        },
      ])}
    />,
  );
  expect(screen.queryByText('<script>literal</script>')).toBeInTheDocument();
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('br')).toBeInTheDocument();
  expect(screen.getByText('Bold').tagName).toBe('STRONG');
  expect(screen.getByText('Italic').tagName).toBe('EM');
  expect(screen.getByText('Both').closest('strong')).toBeInTheDocument();
  expect(screen.getByText('Both').closest('em')).toBeInTheDocument();
  expect(container.querySelector('ol')).toHaveAttribute('start', '3');
  expect(screen.getByText('Nested point').closest('ul')?.closest('li')).toHaveTextContent(
    'Step three',
  );
});

// A destination must come from composition; rebuilding it here could select another generation.
it('uses the supplied resolved link and indicates its new-tab behavior', () => {
  render(
    <CaseText
      newTabLabel="opens a new tab"
      resolveLink={(link) =>
        link.destination === 'resume'
          ? { href: '/media/00000000-0000-4000-8000-000000000001/original', newTab: true }
          : null
      }
      content={content([
        paragraph([
          {
            ...element,
            type: 'link',
            version: 3,
            fields: { linkType: 'custom', destination: 'resume' },
            children: [leaf('Read resume')],
          },
        ]),
      ])}
    />,
  );
  const link = screen.queryByRole('link', { name: 'Read resume opens a new tab' });
  expect(link).toHaveAttribute('href', '/media/00000000-0000-4000-8000-000000000001/original');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

// Approved missing-current-locale target behavior preserves readable children without a fake href.
it('keeps unavailable targets as formatted nonclickable text', () => {
  const { container } = render(
    <CaseText
      newTabLabel="new tab"
      resolveLink={() => null}
      content={content([
        paragraph([
          {
            ...element,
            type: 'link',
            version: 3,
            fields: {
              linkType: 'custom',
              destination: 'case',
              case: '00000000-0000-4000-8000-000000000001',
            },
            children: [leaf('Unavailable study', 1)],
          },
        ]),
      ])}
    />,
  );
  expect(screen.queryByText('Unavailable study')).toBeInTheDocument();
  expect(container.querySelector('strong')).toHaveTextContent('Unavailable study');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('preserves same-tab links without extra new-tab copy', () => {
  render(
    <CaseText
      newTabLabel="new tab"
      resolveLink={() => ({ href: '#contact' })}
      content={content([
        paragraph([
          {
            ...element,
            type: 'link',
            version: 3,
            fields: { linkType: 'custom', destination: 'contact' },
            children: [leaf('Contact')],
          },
        ]),
      ])}
    />,
  );
  expect(screen.queryByRole('link', { name: 'Contact' })).toHaveAttribute('href', '#contact');
  expect(screen.getByRole('link')).not.toHaveAttribute('target');
});

// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SlugSuggestion } from './slug-suggestion';
const model = vi.hoisted(() => ({
  title: 'Design para',
  titleEmphasis: 'a vida',
  slug: 'endereco-reservado',
}));
vi.mock('@payloadcms/ui', () => ({
  useFormFields: (selector: (args: unknown[]) => unknown) =>
    selector([{ title: { value: model.title }, titleEmphasis: { value: model.titleEmphasis } }]),
  useField: () => ({
    setValue: (value: string) => {
      model.slug = value;
    },
  }),
  Button: ({
    children,
    buttonStyle: _style,
    size: _size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { buttonStyle?: string; size?: string }) => (
    <button {...props} data-style={_style} data-size={_size}>
      {children}
    </button>
  ),
}));
afterEach(cleanup);
it('changes an existing slug only on explicit click and composes the normal and emphasized title', () => {
  model.slug = 'endereco-reservado';
  const view = render(<SlugSuggestion />);
  expect(model.slug).toBe('endereco-reservado');
  model.titleEmphasis = 'uma vida melhor';
  view.rerender(<SlugSuggestion />);
  expect(model.slug).toBe('endereco-reservado');
  fireEvent.click(screen.getByRole('button', { name: /sugerir a partir do título/i }));
  expect(model.slug).toBe('design-para-uma-vida-melhor');
});
it('does not offer a slug suggestion to a read-only editor', () => {
  render(<SlugSuggestion readOnly />);
  expect(screen.getByRole('button')).toBeDisabled();
});

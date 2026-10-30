// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EditorialUnpublishAction } from './editorial-actions';
const state = vi.hoisted(() => ({
  document: null as unknown,
  modified: true,
  refreshed: false,
  notice: '',
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: () => {
      state.refreshed = true;
    },
  }),
}));
vi.mock('./editorial-fields', () => ({ useEditorialLeaseLifecycle: () => {} }));
vi.mock('@payloadcms/ui', () => ({
  useDocumentInfo: () => ({
    id: 'case-id',
    collectionSlug: 'case-content',
    hasPublishedDoc: true,
    hasPublishPermission: true,
    setHasPublishedDoc: () => {},
    setData: (doc: unknown) => {
      state.document = doc;
    },
  }),
  useForm: () => ({
    getData: () => ({ editorialRevision: 'revision', leaseToken: 'lease' }),
    reset: async (doc: unknown) => {
      state.document = doc;
    },
    setModified: (value: boolean) => {
      state.modified = value;
    },
  }),
  useModal: () => ({ openModal: () => {} }),
  PopupList: {
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
  },
  ConfirmationModal: ({ onConfirm }: { onConfirm: () => void }) => (
    <button onClick={onConfirm}>Confirm</button>
  ),
  toast: {
    warning: (message: string) => {
      state.notice = message;
    },
    info: (message: string) => {
      state.notice = message;
    },
    success: (message: string) => {
      state.notice = message;
    },
    error: (message: string) => {
      state.notice = message;
    },
  },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('shows the partial withdrawal message while preserving the saved-document reset and reload', async () => {
  state.notice = '';
  state.modified = true;
  state.refreshed = false;
  const saved = { id: 'case-id', _status: 'draft' };
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          doc: saved,
          publicationReceipt: { state: 'update-pending' },
          message: 'Conteúdo salvo. Atualização pública pendente; tente novamente.',
        }),
        { status: 200 },
      ),
  );
  render(<EditorialUnpublishAction />);
  fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(state.notice).toMatch(/atualização pública pendente/i));
  expect(state.document).toEqual(saved);
  expect(state.modified).toBe(false);
  expect(state.refreshed).toBe(true);
});

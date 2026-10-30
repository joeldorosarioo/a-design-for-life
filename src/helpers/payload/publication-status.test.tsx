// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PublicationStatus } from './publication-status';
const ui = vi.hoisted(() => ({
  info: {
    id: 'case-1',
    collectionSlug: 'cases',
    data: { editorialRevision: 'draft-b' },
    hasSavePermission: true,
    hasPublishPermission: true,
    documentIsLocked: false,
    isInitializing: false,
  },
  processing: false,
  modified: false,
  backgroundProcessing: false,
}));
vi.mock('@payloadcms/ui', () => ({
  useDocumentInfo: () => ui.info,
  useForm: () => ({ disabled: false, backgroundProcessing: ui.backgroundProcessing }),
  useFormProcessing: () => ui.processing,
  useFormBackgroundProcessing: () => ui.backgroundProcessing,
  useFormModified: () => ui.modified,
  Banner: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
const pending = {
  operationId: '11111111-1111-4111-8111-111111111111',
  targetRevision: '22222222-2222-4222-8222-222222222222',
  state: 'update-pending',
};
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  ui.info = {
    id: 'case-1',
    collectionSlug: 'cases',
    data: { editorialRevision: 'draft-b' },
    hasSavePermission: true,
    hasPublishPermission: true,
    documentIsLocked: false,
    isInitializing: false,
  };
  ui.processing = false;
  ui.modified = false;
  ui.backgroundProcessing = false;
});
it('shows a persisted pending update for shared Cases without a locale and retries only that operation', async () => {
  let retried = false;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.endsWith('/publication-retry')) {
      expect(JSON.parse(String(init?.body))).toEqual({
        operationId: '11111111-1111-4111-8111-111111111111',
      });
      retried = true;
      return response({ ok: true, value: { ...pending, state: 'public' } });
    }
    expect(url).toBe('/api/cases/case-1/publication-status');
    return response({ receipt: retried ? { ...pending, state: 'public' } : pending });
  });
  render(<PublicationStatus />);
  await screen.findByText(/atualização pública pendente/i);
  fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
  await screen.findByText(/última atualização pública confirmada/i);
  expect(screen.queryByText(/rascunho.*público/i)).not.toBeInTheDocument();
});
it('keeps retry disabled during the request and recovers from network failure without touching the draft', async () => {
  let rejectRetry!: (error: Error) => void;
  vi.stubGlobal('fetch', async (url: string) =>
    url.endsWith('/publication-status')
      ? response({ receipt: pending })
      : new Promise((_resolve, reject) => {
          rejectRetry = reject;
        }),
  );
  render(<PublicationStatus />);
  const retry = await screen.findByRole('button', { name: /tentar novamente/i });
  fireEvent.click(retry);
  expect(retry).toBeDisabled();
  await act(async () => {
    rejectRetry(new Error('offline'));
  });
  await screen.findByText(/não foi possível.*tente novamente/i);
  expect(retry).toBeEnabled();
  expect(ui.info.data.editorialRevision).toBe('draft-b');
});
it('does not treat an older public target as the current draft and disables retry for a locked editor', async () => {
  vi.stubGlobal('fetch', async () => response({ receipt: { ...pending, state: 'public' } }));
  const view = render(<PublicationStatus />);
  await screen.findByText(/última atualização pública confirmada/i);
  expect(screen.queryByText(/conteúdo atual.*público|rascunho publicado/i)).not.toBeInTheDocument();
  ui.info.documentIsLocked = true;
  ui.info.data.editorialRevision = 'draft-c';
  vi.stubGlobal('fetch', async () => response({ receipt: pending }));
  view.rerender(<PublicationStatus />);
  expect(await screen.findByRole('button', { name: /tentar novamente/i })).toBeDisabled();
});
it('ignores a stale status response after the selected document changes', async () => {
  let resolveOld!: (response: Response) => void;
  vi.stubGlobal('fetch', async (url: string) =>
    url.includes('case-1')
      ? new Promise<Response>((resolve) => {
          resolveOld = resolve;
        })
      : response({
          receipt: {
            ...pending,
            operationId: '44444444-4444-4444-8444-444444444444',
            state: 'public',
          },
        }),
  );
  const view = render(<PublicationStatus />);
  ui.info.id = 'case-2';
  view.rerender(<PublicationStatus />);
  await screen.findByText(/última atualização pública confirmada/i);
  await act(async () => {
    resolveOld(response({ receipt: pending }));
  });
  expect(screen.queryByRole('button', { name: /tentar novamente/i })).not.toBeInTheDocument();
});
it('explains a superseded retry and reloads the latest intention instead of confirming the old operation', async () => {
  let retried = false;
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.endsWith('/publication-retry')) {
      retried = true;
      return response({ ok: true, value: { ...pending, state: 'superseded' } });
    }
    return response({
      receipt: retried
        ? { ...pending, operationId: '33333333-3333-4333-8333-333333333333', state: 'public' }
        : pending,
    });
  });
  render(<PublicationStatus />);
  fireEvent.click(await screen.findByRole('button', { name: /tentar novamente/i }));
  await screen.findByText(/substituída.*mais recente/i);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /tentar novamente/i })).not.toBeInTheDocument(),
  );
});

it('keeps retry disabled while native form submission or background processing is active', async () => {
  vi.stubGlobal('fetch', async () => response({ receipt: pending }));
  ui.processing = true;
  const view = render(<PublicationStatus />);
  expect(await screen.findByRole('button', { name: /tentar novamente/i })).toBeDisabled();
  ui.processing = false;
  ui.backgroundProcessing = true;
  view.rerender(<PublicationStatus />);
  expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeDisabled();
});
it('does not claim any public confirmation when no publication intention exists', async () => {
  vi.stubGlobal('fetch', async () => response({ receipt: null }));
  render(<PublicationStatus />);
  await act(async () => {});
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

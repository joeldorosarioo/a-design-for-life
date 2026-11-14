import { expect, it, vi } from 'vitest';
import { authorizePrivatePreviewRequest } from './prepare-private-preview-request';

vi.mock('@/helpers/payload/preview-session', () => ({
  authorizePreview: async () => ({
    ok: false,
    error: { code: 'forbidden', message: 'Authentication required.' },
  }),
}));

const request = () =>
  new Request(
    'https://preview.example.invalid/preview-ui/pt/professional-profiles/11111111-1111-4111-8111-111111111111/home',
  );

it.each([
  'https://preview.example.invalid/',
  'https://preview.example.invalid:443',
  'https://PREVIEW.EXAMPLE.INVALID',
])('reaches session authentication for equivalent configured origin %s', async (origin) => {
  const result = await authorizePrivatePreviewRequest(request(), { origin });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.response.status).toBe(401);
});

it.each([
  'ftp://preview.example.invalid',
  'https://user:password@preview.example.invalid',
  'https://preview.example.invalid/path',
  'https://preview.example.invalid?query=value',
  'https://preview.example.invalid#fragment',
])('rejects configured preview origin with extra data: %s', async (origin) => {
  const result = await authorizePrivatePreviewRequest(request(), { origin });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.response.status).toBe(503);
});

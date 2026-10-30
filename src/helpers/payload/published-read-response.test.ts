import { expect, it } from 'vitest';
import { publishedReadStatus } from './published-read-response';
const subject = {
  collection: 'professional-profiles' as const,
  where: { locale: { equals: 'pt' } },
};
it('preserves200 for a confirmed DTO without consulting Native metadata', async () => {
  await expect(
    publishedReadStatus({ ok: true, value: { title: 'Confirmed' } }, subject, undefined as never),
  ).resolves.toBe(200);
});
it('preserves404 for a non-unavailable result without consulting Native metadata', async () => {
  await expect(
    publishedReadStatus(
      { ok: false, error: { code: 'forbidden', message: 'Safe unavailable' } },
      subject,
      undefined as never,
    ),
  ).resolves.toBe(404);
});
it('keeps503 when the origin cannot prove absence', async () => {
  await expect(
    publishedReadStatus(
      { ok: false, error: { code: 'unavailable', message: 'Safe unavailable' } },
      subject,
      undefined as never,
    ),
  ).resolves.toBe(503);
});

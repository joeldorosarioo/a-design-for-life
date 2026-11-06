import { afterEach, expect, it, vi } from 'vitest';
import type { Payload, PayloadEmailAdapter } from 'payload';
import { editorialEmailAdapter } from './editorial-email';

const options = {
  apiKey: 're_synthetic_key_for_transport_tests_only',
  fromAddress: 'a-design-for-life@mail.joeldorosarioo.dev',
  fromName: 'A Design for Life',
};
const databaseURI = 'postgres://local:synthetic@127.0.0.1:55434/adfl_test_mail_transport';
afterEach(() => vi.unstubAllGlobals());
function adapter(environment: string, settings = options) {
  const factory: PayloadEmailAdapter = editorialEmailAdapter(environment, databaseURI, settings);
  return factory({ payload: {} as Payload });
}

// Ignoring configured remote delivery would keep password recovery unavailable outside local capture.
it.each(['staging', 'production'])(
  'delivers native recovery through the configured Resend transport in %s',
  async (environment) => {
    const sent: { url: string; body: unknown; authorization: string | null }[] = [];
    vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
      sent.push({
        url: String(url),
        body: JSON.parse(String(init?.body)),
        authorization: new Headers(init?.headers).get('authorization'),
      });
      return Response.json({ id: 'synthetic-provider-message-id' });
    });
    await adapter(environment).sendEmail({
      to: 'editor@example.invalid',
      subject: 'Synthetic recovery',
      html: '<p>Synthetic recovery content</p>',
    });
    expect(sent).toMatchObject([
      {
        url: 'https://api.resend.com/emails',
        authorization: 'Bearer re_synthetic_key_for_transport_tests_only',
        body: {
          from: 'A Design for Life <a-design-for-life@mail.joeldorosarioo.dev>',
          to: 'editor@example.invalid',
          subject: 'Synthetic recovery',
          html: '<p>Synthetic recovery content</p>',
        },
      },
    ]);
  },
);

// Provider errors must not leak a reset link or recipient through Payload's error/log path.
it('turns a rejected provider response into a safe editorial failure', async () => {
  vi.stubGlobal('fetch', async () =>
    Response.json(
      {
        name: 'validation_error',
        message: 'private-recipient@example.invalid secret-reset-token',
      },
      { status: 422 },
    ),
  );
  await expect(
    adapter('staging').sendEmail({
      to: 'editor@example.invalid',
      html: 'Synthetic recovery content',
    }),
  ).rejects.toThrow('Editorial email delivery is unavailable.');
});

// A broken network must not silently report password recovery as delivered.
it('turns a failed provider connection into a safe editorial failure', async () => {
  vi.stubGlobal('fetch', async () => {
    throw new Error('synthetic-network-error secret-reset-token');
  });
  await expect(
    adapter('production').sendEmail({
      to: 'editor@example.invalid',
      html: 'Synthetic recovery content',
    }),
  ).rejects.toThrow('Editorial email delivery is unavailable.');
});

// A project cannot accidentally send with a different account/domain identity.
it('uses only the configured sender even if an internal message supplies another from address', async () => {
  let body: Record<string, unknown> = {};
  vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
    body = JSON.parse(String(init.body));
    return Response.json({ id: 'synthetic-provider-message-id' });
  });
  await adapter('staging').sendEmail({
    from: 'other@outside.example.invalid',
    to: 'editor@example.invalid',
    html: 'Synthetic content',
  });
  expect(body.from).toBe('A Design for Life <a-design-for-life@mail.joeldorosarioo.dev>');
});

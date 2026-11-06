import 'server-only';

/** Native already generated its HttpOnly session cookie before this boundary. */
export async function protectNativeFirstUserResponse(
  response: Response,
  slug: string[] | undefined,
): Promise<Response> {
  if (slug?.length !== 2 || slug[0] !== 'users' || slug[1].toLowerCase() !== 'first-register')
    return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, max-age=0');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (response.status < 200 || response.status >= 300)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    /* Refuse an unexpected successful Native contract below. */
  }
  headers.delete('content-length');
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return Response.json(
      { errors: [{ message: 'First account response unavailable.' }] },
      { status: 503, headers },
    );
  const safe = { ...body } as Record<string, unknown>;
  delete safe.token;
  return Response.json(safe, { status: response.status, statusText: response.statusText, headers });
}

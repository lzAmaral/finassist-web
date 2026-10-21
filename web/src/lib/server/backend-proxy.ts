// A origem pública é validada antes de adaptar Origin ao Host real do transporte Go.
export async function proxyBackend(
  request: Request,
  publicURL: URL,
  base: URL,
  path: string,
  transport: typeof fetch = fetch
): Promise<Response> {
  if (
    !['GET', 'HEAD'].includes(request.method) &&
    request.headers.get('origin') !== publicURL.origin
  )
    return Response.json({ error: 'Origem não permitida.' }, { status: 403 });
  const target = new URL(`/api/${path}`, base);
  target.search = publicURL.search;
  const headers = new Headers();
  for (const key of ['cookie', 'content-type', 'accept']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set('host', base.host);
  headers.set('origin', base.origin);
  headers.set('x-forwarded-proto', publicURL.protocol.slice(0, -1));
  try {
    const response = await transport(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      duplex: 'half',
      redirect: 'manual',
      signal: AbortSignal.timeout(20000)
    } as RequestInit);
    const result = new Headers({
      'content-type':
        response.headers.get('content-type') ?? 'application/json',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff'
    });
    for (const cookie of response.headers.getSetCookie())
      result.append('set-cookie', cookie);
    return new Response(response.body, {
      status: response.status,
      headers: result
    });
  } catch {
    return Response.json(
      {
        error:
          'Não foi possível alcançar o backend. Verifique se ele está disponível.'
      },
      { status: 502 }
    );
  }
}

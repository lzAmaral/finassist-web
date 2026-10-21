import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { backendURL } from '#lib/server/backend.js';

const proxy: RequestHandler = async ({ request, url, params }) => {
  const base = backendURL();
  if (!base)
    return json(
      {
        error:
          'Esta versão está em demonstração. A API real ainda não foi configurada.'
      },
      { status: 503 }
    );
  if (
    !['GET', 'HEAD'].includes(request.method) &&
    request.headers.get('origin') !== url.origin
  )
    return json({ error: 'Origem não permitida.' }, { status: 403 });
  const target = new URL(base);
  target.pathname = `/api/${params.path}`;
  target.search = url.search;
  const headers = new Headers();
  for (const key of ['cookie', 'content-type', 'accept']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  // O Go confere a origem contra o Host recebido; preserve a origem pública depois de validá-la.
  headers.set('host', url.host);
  headers.set('origin', url.origin);
  headers.set('x-forwarded-proto', url.protocol.slice(0, -1));
  try {
    const response = await fetch(target, {
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
    return json(
      {
        error:
          'Não foi possível alcançar o backend. Verifique se ele está disponível.'
      },
      { status: 502 }
    );
  }
};
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

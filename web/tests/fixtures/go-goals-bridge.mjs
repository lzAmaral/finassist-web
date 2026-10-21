import assert from 'node:assert/strict';
import { proxyBackend } from '../../src/lib/server/backend-proxy.ts';

const base = new URL(process.env.FA02_BACKEND_URL);
const origin = 'https://web.synthetic';
const future = new Date();
future.setUTCMonth(future.getUTCMonth() + 6);
const targetDate = future.toISOString().slice(0, 7);
let cookie = '';
async function call(path, method = 'GET', body) {
  const url = new URL(`/api/${path}`, origin);
  const headers = { origin, 'content-type': 'application/json', cookie };
  const response = await proxyBackend(
    new Request(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    }),
    url,
    base,
    path
  );
  if (response.headers.get('set-cookie'))
    cookie = response.headers.get('set-cookie').split(';')[0];
  return response;
}
assert.equal((await call('goals')).status, 401);
assert.equal(
  (await call('login', 'POST', { password: 'senha-sintetica-fa02' })).status,
  200
);
const created = await call('goals', 'POST', {
  kind: 'SAVE',
  name: 'Prova Svelte PostgreSQL',
  targetAmount: 1234.56,
  targetDate
});
assert.equal(created.status, 201, await created.clone().text());
const { id } = await created.json();
const reload = await call('goals');
assert.equal(reload.status, 200);
const viaSvelte = (await reload.json()).goals.find((g) => g.id === id);
assert.equal(viaSvelte.name, 'Prova Svelte PostgreSQL');
assert.equal(viaSvelte.target, 1234.56);
const direct = await fetch(new URL('/api/goals', base), {
  headers: { cookie }
});
const viaGo = (await direct.json()).goals.find((g) => g.id === id);
assert.deepEqual(viaSvelte, viaGo);
const denied = await proxyBackend(
  new Request(new URL('/api/goals', origin), {
    method: 'POST',
    headers: { origin: 'https://evil.synthetic' },
    body: '{}'
  }),
  new URL('/api/goals', origin),
  base,
  'goals'
);
assert.equal(denied.status, 403);
const invalid = await call('goals', 'POST', {
  kind: 'SAVE',
  name: '',
  targetAmount: -1,
  targetDate
});
assert.equal(invalid.status, 400);
// O teste Go reabre a conexão e verifica a linha antes da limpeza.
process.stdout.write(id);

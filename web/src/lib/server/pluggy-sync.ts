import { cloudConfig } from './cloud-config.js';
import { readSnapshot, writeSnapshot } from './cloud-store.js';
import type { Account, Movement, Snapshot } from './finance-data.js';

let pending: Promise<Snapshot> | undefined;
async function synchronize(): Promise<Snapshot> {
  const previous = await readSnapshot(true);
  if (previous && Date.now() - Date.parse(previous.value.syncedAt) < 5 * 60_000)
    return previous.value;
  const c = cloudConfig();
  const signal = AbortSignal.timeout(90_000);
  const auth = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientId: c.clientId,
      clientSecret: c.clientSecret
    }),
    signal
  });
  if (!auth.ok)
    throw new Error(`Autenticação Pluggy indisponível (${auth.status}).`);
  const { apiKey } = await auth.json();
  if (typeof apiKey !== 'string')
    throw new Error('Autenticação Pluggy inválida.');
  async function get<T>(path: string): Promise<T> {
    // Never forward the credential to a pagination URL supplied by a third party.
    const url = new URL(path, 'https://api.pluggy.ai');
    if (url.origin !== 'https://api.pluggy.ai')
      throw new Error('Paginação Pluggy inválida.');
    const result = await fetch(url, {
      headers: { 'X-API-KEY': apiKey },
      signal,
      cache: 'no-store'
    });
    if (!result.ok)
      throw new Error(`Consulta Pluggy indisponível (${result.status}).`);
    return result.json();
  }
  const items = await Promise.all(
    c.itemIds.map(async (id) => {
      const item = await get<{ status: string; lastUpdatedAt?: string }>(
        `/items/${encodeURIComponent(id)}`
      );
      return { id, status: item.status, updatedAt: item.lastUpdatedAt ?? null };
    })
  );
  const accounts = (
    await Promise.all(
      c.itemIds.map(async (itemId) => {
        const all: Account[] = [];
        for (let page = 1; page <= 100; page++) {
          const data = await get<{ results: Account[]; totalPages: number }>(
            `/accounts?itemId=${encodeURIComponent(itemId)}&page=${page}`
          );
          for (const a of data.results) {
            if (!a.id || !Number.isFinite(a.balance))
              throw new Error('Conta inválida recebida da Pluggy.');
            // Deliberately omit CPF, account numbers, owner and identity data.
            all.push({
              id: a.id,
              itemId,
              type: a.type,
              name: a.name,
              balance: a.balance,
              currencyCode: a.currencyCode
            });
          }
          if (page >= data.totalPages) return all;
        }
        throw new Error('Paginação de contas excedeu o limite.');
      })
    )
  ).flat();
  if (!accounts.length)
    throw new Error(
      'A Pluggy ainda não disponibilizou contas para estes itens.'
    );
  const transactions = (
    await Promise.all(
      accounts.map(async (account) => {
        const all: Movement[] = [];
        let path = `/v2/transactions?accountId=${encodeURIComponent(account.id)}`;
        const visited = new Set<string>();
        for (let page = 0; page < 100; page++) {
          if (visited.has(path))
            throw new Error('Cursor de movimentações repetido.');
          visited.add(path);
          const data = await get<{ results: Movement[]; next: string | null }>(
            path
          );
          for (const t of data.results)
            all.push({
              id: t.id,
              accountId: account.id,
              date: t.date,
              description: t.description,
              descriptionRaw: t.descriptionRaw,
              category: t.category,
              amount: t.amount,
              type: t.type,
              status: t.status,
              currencyCode: t.currencyCode,
              amountInAccountCurrency: t.amountInAccountCurrency,
              providerId: t.providerId,
              paymentData: t.paymentData
                ? { paymentMethod: t.paymentData.paymentMethod }
                : undefined,
              creditCardMetadata: t.creditCardMetadata
                ? {
                    installmentNumber: t.creditCardMetadata.installmentNumber,
                    totalInstallments: t.creditCardMetadata.totalInstallments,
                    billForecastDate: t.creditCardMetadata.billForecastDate
                  }
                : undefined
            });
          if (!data.next) return all;
          const next = new URL(
            data.next.startsWith('?')
              ? `/v2/transactions${data.next}`
              : data.next,
            'https://api.pluggy.ai'
          );
          if (
            next.origin !== 'https://api.pluggy.ai' ||
            next.pathname !== '/v2/transactions' ||
            next.searchParams.get('accountId') !== account.id
          )
            throw new Error('Cursor de movimentações inválido.');
          path = next.pathname + next.search;
        }
        throw new Error('Paginação de movimentações excedeu o limite.');
      })
    )
  ).flat();
  const value: Snapshot = {
    version: 1,
    syncedAt: new Date().toISOString(),
    items,
    accounts,
    transactions
  };
  await writeSnapshot(value, previous?.etag);
  return value;
}
export async function syncPluggy() {
  if (pending) return pending;
  pending = synchronize();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}

import type { Dashboard, Transaction } from '../finance.ts';

const PAGE_SIZE = 100;
const MAX_PAGES = 10000;

// Falhar por inteiro evita oferecer busca e CSV com um mês truncado.
export async function loadAllTransactions(
  get: (path: string) => Promise<unknown>,
  month: string
): Promise<Dashboard['transactions']> {
  const items: Transaction[] = [];
  const ids = new Set<string>();
  let total: number | undefined;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const value = await get(
      `transactions?${new URLSearchParams({ month, limit: String(PAGE_SIZE), page: String(page) })}`
    );
    const result = value as {
      items?: Transaction[];
      total?: number;
      page?: number;
      limit?: number;
    } | null;
    if (
      !result ||
      !Array.isArray(result.items) ||
      !Number.isSafeInteger(result.total) ||
      result.total! < 0 ||
      result.page !== page ||
      result.limit !== PAGE_SIZE ||
      (total !== undefined && result.total !== total)
    ) {
      throw new Error(
        'não foi possível carregar o mês completo; recarregue e tente novamente'
      );
    }
    total = result.total!;
    const expected = Math.min(PAGE_SIZE, total - items.length);
    if (result.items.length !== expected || total > MAX_PAGES * PAGE_SIZE) {
      throw new Error(
        'a paginação de transações mudou; recarregue e tente novamente'
      );
    }
    for (const transaction of result.items) {
      if (
        !transaction ||
        typeof transaction.id !== 'string' ||
        !transaction.id ||
        ids.has(transaction.id)
      ) {
        throw new Error(
          'a lista de transações contém duplicações; recarregue e tente novamente'
        );
      }
      ids.add(transaction.id);
      items.push(transaction);
    }
    if (items.length === total) return { items, total };
  }
  throw new Error('não foi possível carregar todas as páginas de transações');
}

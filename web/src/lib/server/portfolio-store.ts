import { randomUUID } from 'node:crypto';
import { readPrivate, writePrivate } from './private-store.js';
import {
  positionInput,
  portfolioView,
  ValidationError
} from './portfolio-data.js';
import type { PortfolioState } from '#lib/investments.js';
import type { Snapshot } from './finance-data.js';

const path = 'finance/portfolio-v1.enc';
async function read() {
  const stored = await readPrivate<PortfolioState>(path);
  if (
    stored &&
    (stored.value.version !== 1 ||
      !Array.isArray(stored.value.positions) ||
      !Array.isArray(stored.value.dividends))
  )
    throw new Error('Carteira inválida.');
  return stored;
}
export async function getPortfolio(snapshot: Snapshot, month: string) {
  const state = (await read())?.value ?? {
    version: 1,
    positions: [],
    dividends: []
  };
  const view = portfolioView(
    state,
    snapshot.investments ?? [],
    snapshot.investmentsSyncedAt ?? null,
    month
  );
  if (snapshot.investmentsError)
    view.importError =
      'A consulta mais recente dos investimentos falhou. As últimas posições disponíveis foram preservadas.';
  return view;
}
export async function updatePortfolio(
  action: string,
  input: unknown,
  snapshot: Snapshot
) {
  const stored = await read();
  const state: PortfolioState = stored?.value ?? {
    version: 1,
    positions: [],
    dividends: []
  };
  const data = input as Record<string, unknown>;
  if (!data || typeof data !== 'object')
    throw new ValidationError('Dados inválidos.');
  if (action === 'position') {
    const fields = positionInput(data);
    const existing = data.id
      ? state.positions.find((p) => p.id === data.id)
      : undefined;
    if (data.id && !existing)
      throw new ValidationError('Posição manual não encontrada.');
    if (existing)
      Object.assign(existing, fields, { updatedAt: new Date().toISOString() });
    else {
      if (state.positions.length >= 1000)
        throw new ValidationError('Limite de posições atingido.');
      state.positions.push({
        ...fields,
        id: randomUUID(),
        source: 'manual',
        updatedAt: new Date().toISOString()
      });
    }
  } else if (action === 'archive') {
    const position = state.positions.find((p) => p.id === data.id);
    if (!position || typeof data.archived !== 'boolean')
      throw new ValidationError('Posição manual não encontrada.');
    position.archived = data.archived;
  } else if (action === 'dividend') {
    const position = [
      ...state.positions,
      ...(snapshot.investments ?? []).map((i) => ({
        id: `pluggy:${i.id}`,
        name: i.name
      }))
    ].find((p) => p.id === data.positionId);
    if (
      !position ||
      typeof data.amount !== 'number' ||
      !Number.isFinite(data.amount) ||
      data.amount <= 0 ||
      data.amount > 1e9
    )
      throw new ValidationError('Informe posição e valor válidos.');
    const date =
      typeof data.date === 'string' ? new Date(`${data.date}T12:00:00Z`) : null;
    if (
      typeof data.date !== 'string' ||
      !/^20\d{2}-\d{2}-\d{2}$/.test(data.date) ||
      !date ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== data.date ||
      data.date >
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo'
        }).format(new Date())
    )
      throw new ValidationError(
        'Use a data válida de um pagamento já recebido.'
      );
    if (!['DIVIDEND', 'JCP', 'YIELD'].includes(String(data.type)))
      throw new ValidationError('Tipo de provento inválido.');
    if (state.dividends.length >= 10000)
      throw new ValidationError('Limite de proventos atingido.');
    state.dividends.push({
      id: randomUUID(),
      positionId: position.id,
      name: position.name,
      date: data.date,
      amount: Math.round(data.amount * 100) / 100,
      type: data.type as 'DIVIDEND' | 'JCP' | 'YIELD'
    });
  } else if (action === 'archive-dividend') {
    const dividend = state.dividends.find((d) => d.id === data.id);
    if (!dividend || typeof data.archived !== 'boolean')
      throw new ValidationError('Provento não encontrado.');
    dividend.archived = data.archived;
  } else throw new ValidationError('Operação desconhecida.');
  await writePrivate(path, state, stored?.etag);
}

export const manualCategories = [
  ['FOOD', 'Alimentação'],
  ['MARKET', 'Mercado'],
  ['TRANSPORT', 'Transporte'],
  ['HEALTH', 'Saúde'],
  ['ENTERTAINMENT', 'Lazer'],
  ['SHOPPING', 'Compras'],
  ['HOUSING', 'Moradia'],
  ['BILLS', 'Contas'],
  ['EDUCATION', 'Educação'],
  ['PEOPLE', 'Pessoas'],
  ['OTHER', 'Outros']
] as const;
export const manualPaymentMethods = [
  ['PIX', 'Pix'],
  ['DEBIT_CARD', 'Cartão de débito'],
  ['CASH', 'Dinheiro'],
  ['OTHER', 'Outro']
] as const;
export const manualPendingKey = 'finassist.manual-entry.pending.v1';
export const manualMinimumDate = '2000-01-01';
export type ManualAccount = {
  id: string;
  type: 'BANK';
  name: string;
  last4?: string;
};
export function manualAccountLabel(
  account: ManualAccount,
  accounts: ManualAccount[]
): string {
  const base = (item: ManualAccount) => {
    const last4 =
      typeof item.last4 === 'string' ? item.last4.trim().slice(-4) : '';
    return `${item.name}${last4 ? ` · final ${last4}` : ''}`;
  };
  const name = base(account);
  const duplicates = accounts.filter(
    (item) => base(item) === name && item.id !== account.id
  );
  if (!duplicates.length) return name;
  let length = 8;
  while (
    length < account.id.length &&
    duplicates.some(
      (item) => item.id.slice(0, length) === account.id.slice(0, length)
    )
  )
    length += 4;
  return `${name} · ID ${account.id.slice(0, length)}`;
}
export type ManualPayload = Readonly<{
  requestId: string;
  amountCents: number;
  description: string;
  date: string;
  accountId: string;
  category: string;
  paymentMethod: string;
}>;
export type ManualReceipt = {
  id: string;
  purchaseId: string;
  requestId: string;
  date: string;
  amountCents: number;
  replayed: boolean;
};
export type ManualFields = {
  amount: string;
  description: string;
  date: string;
  accountId: string;
  category: string;
  paymentMethod: string;
};
type PendingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Fetcher = typeof fetch;
class ManualRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
const payloadKeys = [
  'requestId',
  'amountCents',
  'description',
  'date',
  'accountId',
  'category',
  'paymentMethod'
];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isUUID = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  ) &&
  value !== '00000000-0000-0000-0000-000000000000';

export function parseManualAmount(value: string): number | null {
  const text = value.trim();
  if (
    text.length > 40 ||
    !/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)
  )
    return null;
  const [whole, decimal = ''] = text.split(',');
  const cents =
    BigInt(whole.replaceAll('.', '')) * 100n + BigInt(decimal.padEnd(2, '0'));
  return cents >= 1n && cents <= 999999999999n ? Number(cents) : null;
}

export function isManualDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return (
    year > 0 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <=
      [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  );
}

function validPayload(value: unknown): value is ManualPayload {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== payloadKeys.length ||
    payloadKeys.some((key) => !(key in value))
  )
    return false;
  return (
    isUUID(value.requestId) &&
    isUUID(value.accountId) &&
    Number.isSafeInteger(value.amountCents) &&
    Number(value.amountCents) >= 1 &&
    Number(value.amountCents) <= 999999999999 &&
    typeof value.description === 'string' &&
    value.description === value.description.trim() &&
    Array.from(value.description).length >= 1 &&
    Array.from(value.description).length <= 200 &&
    isManualDate(value.date) &&
    value.date >= manualMinimumDate &&
    manualCategories.some(([key]) => key === value.category) &&
    manualPaymentMethods.some(([key]) => key === value.paymentMethod)
  );
}

export function prepareManualPayload(
  fields: ManualFields,
  accounts: ManualAccount[],
  referenceDate: string,
  requestId: string
): ManualPayload {
  const amountCents = parseManualAmount(fields.amount);
  if (amountCents === null)
    throw new Error(
      'informe um valor de R$ 0,01 a R$ 9.999.999.999,99, com até dois decimais.'
    );
  if (
    !isManualDate(fields.date) ||
    fields.date < manualMinimumDate ||
    !isManualDate(referenceDate) ||
    fields.date > referenceDate
  )
    throw new Error(
      'informe uma data válida desde 01/01/2000 até hoje, no horário de São Paulo.'
    );
  const description = fields.description.trim();
  if (!description || Array.from(description).length > 200)
    throw new Error('informe uma descrição de 1 a 200 caracteres.');
  if (
    !accounts.some(
      (account) => account.type === 'BANK' && account.id === fields.accountId
    )
  )
    throw new Error('escolha uma conta bancária disponível.');
  const payload = {
    requestId,
    amountCents,
    description,
    date: fields.date,
    accountId: fields.accountId,
    category: fields.category,
    paymentMethod: fields.paymentMethod
  };
  if (!validPayload(payload))
    throw new Error('confira a categoria e o meio de pagamento.');
  return Object.freeze(payload);
}

export async function loadManualAccounts(
  fetcher: Fetcher = fetch
): Promise<ManualAccount[]> {
  const response = await fetcher('/api/accounts', { redirect: 'error' });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(value))
    throw new Error('não foi possível carregar as contas. Tente novamente.');
  return value.filter(
    (account): account is ManualAccount =>
      isRecord(account) &&
      account.type === 'BANK' &&
      isUUID(account.id) &&
      typeof account.name === 'string' &&
      Boolean(account.name.trim())
  );
}

export async function postManualEntry(
  payload: ManualPayload,
  fetcher: Fetcher = fetch
): Promise<ManualReceipt> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    response = await fetcher('/api/transactions/manual', {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error(
      'a conexão foi interrompida. O resultado é incerto; tente novamente com os mesmos dados.'
    );
  } finally {
    clearTimeout(timeout);
  }
  const value: unknown = await response.json().catch(() => null);
  if (response.status !== 200 && response.status !== 201) {
    const messages: Record<number, string> = {
      400: 'os dados não foram aceitos. Confira a tentativa antes de reenviar.',
      401: 'a sessão expirou. Entre novamente para retomar esta tentativa.',
      403: 'o envio não foi autorizado. Reabra o aplicativo para retomar esta tentativa.',
      409: 'a chave desta tentativa já está associada a outro conteúdo. Não inicie outro lançamento; confira as transações.',
      503: 'o lançamento está indisponível no momento. Tente novamente com os mesmos dados.'
    };
    // A resposta remota pode conter páginas de login ou detalhes internos.
    throw new ManualRequestError(
      messages[response.status] ??
        'não foi possível confirmar o lançamento. Tente novamente com os mesmos dados.',
      response.status
    );
  }
  if (
    !isRecord(value) ||
    !isUUID(value.id) ||
    !isUUID(value.purchaseId) ||
    value.requestId !== payload.requestId ||
    value.date !== payload.date ||
    value.amountCents !== payload.amountCents ||
    typeof value.replayed !== 'boolean' ||
    value.replayed !== (response.status === 200)
  ) {
    throw new Error(
      'a resposta não confirmou os dados enviados. Tente novamente com os mesmos dados.'
    );
  }
  return {
    id: value.id,
    purchaseId: value.purchaseId,
    requestId: payload.requestId,
    date: payload.date,
    amountCents: payload.amountCents,
    replayed: value.replayed
  };
}

export class ManualEntrySession {
  pending: ManualPayload | null = null;
  receipt: ManualReceipt | null = null;
  confirmedPayload: ManualPayload | null = null;
  saving = false;
  blocked = false;
  error = '';
  refreshError = '';
  storageWarning = '';
  private storage: PendingStorage | null;
  private fetcher: Fetcher;

  constructor(storage: PendingStorage | null, fetcher: Fetcher = fetch) {
    this.storage = storage;
    this.fetcher = fetcher;
    try {
      if (!storage) throw new Error();
      const raw = storage.getItem(manualPendingKey);
      if (raw === null) return;
      const saved: unknown = JSON.parse(raw);
      if (
        !isRecord(saved) ||
        saved.version !== 1 ||
        !validPayload(saved.payload)
      ) {
        this.blocked = true;
        this.error =
          'não foi possível recuperar a tentativa anterior. Confira as transações antes de iniciar outro lançamento nesta aba.';
        return;
      }
      this.pending = Object.freeze({ ...saved.payload });
    } catch {
      this.blocked = true;
      this.error =
        'não foi possível verificar se há uma tentativa anterior nesta aba. Reative o armazenamento da sessão e recarregue para continuar.';
    }
  }

  async submit(
    payload?: ManualPayload,
    onSaved?: (date: string) => void | Promise<void>
  ): Promise<void> {
    if (this.saving || this.receipt || this.blocked) return;
    if (
      this.pending &&
      payload &&
      JSON.stringify(this.pending) !== JSON.stringify(payload)
    )
      throw new Error(
        'resolva a tentativa pendente com os mesmos dados antes de editar.'
      );
    const recovering = this.pending !== null;
    if (!this.pending) {
      if (!payload || !validPayload(payload))
        throw new Error('confira os dados antes de confirmar.');
      this.pending = Object.freeze({ ...payload });
    }
    const submitted = this.pending;
    this.saving = true;
    this.error = '';
    try {
      try {
        this.storage!.setItem(
          manualPendingKey,
          JSON.stringify({ version: 1, payload: submitted })
        );
      } catch {
        this.storageWarning =
          'o navegador não guardou esta tentativa. Mantenha esta página aberta: a retomada após recarregar não está protegida.';
      }
      this.receipt = await postManualEntry(submitted, this.fetcher);
      this.confirmedPayload = submitted;
      this.pending = null;
      try {
        this.storage!.removeItem(manualPendingKey);
        this.storageWarning = '';
      } catch {
        this.storageWarning =
          'despesa salva, mas o navegador não removeu a tentativa. Ao recarregar, reenvie apenas para confirmar o mesmo registro.';
      }
      try {
        await onSaved?.(this.receipt.date);
      } catch {
        this.refreshError =
          'a despesa foi salva, mas a lista não foi atualizada. Recarregue as transações; não é necessário reenviar.';
      }
    } catch (error) {
      // Uma rejeição explícita inicial permite corrigir. Depois de ambiguidade,
      // a mesma validação pode ocorrer antes da consulta de idempotência.
      if (
        !recovering &&
        error instanceof ManualRequestError &&
        error.status === 400
      ) {
        this.pending = null;
        try {
          this.storage!.removeItem(manualPendingKey);
        } catch {
          this.storageWarning =
            'a tentativa rejeitada não foi removida da sessão. Evite recarregar até corrigir e confirmar os dados.';
        }
      }
      this.error =
        error instanceof Error && !(error instanceof TypeError)
          ? error.message
          : 'a conexão foi interrompida. O resultado é incerto; tente novamente com os mesmos dados.';
    } finally {
      this.saving = false;
    }
  }

  startAnother(): void {
    if (this.pending || this.saving || this.blocked) return;
    this.receipt = null;
    this.confirmedPayload = null;
    this.refreshError = '';
    this.error = '';
  }
}

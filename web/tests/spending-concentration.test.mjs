import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONCENTRATION_GROUP_LIMIT,
  CONCENTRATION_EVIDENCE_PAGE_SIZE,
  concentrationAccountLabel,
  concentrationEvidencePage,
  concentrationGroups,
  spendingConcentration
} from '../src/lib/spending-concentration.ts';

const transaction = (id, changes = {}) => ({
  id,
  date: '2026-11-04',
  description: 'COMPRA NO EXTRATO',
  amount: 10,
  kind: 'EXPENSE',
  status: 'POSTED',
  accountId: 'account-a',
  accountName: 'Conta',
  category: 'OTHER',
  categoryLabel: 'Outros',
  paymentMethodLabel: 'Cartão',
  ...changes
});
const dashboard = (items, changes = {}) => ({
  mode: 'live',
  month: '2026-11',
  transactions: { items, total: items.length },
  ...changes
});
function available(items, changes) {
  const result = spendingConcentration(dashboard(items, changes));
  assert.equal(result.available, true);
  return result;
}

test('agrupa descrição exatamente igual, com compras, estornos e centavos separados', () => {
  const result = available([
    transaction('1', { amount: 100 }),
    transaction('2', { amount: -20, status: 'PAID' }),
    transaction('3', { amount: 0.1 }),
    transaction('4', { amount: 0.2 }),
    transaction('5', { amount: 0 })
  ]);
  assert.equal(result.groups.length, 1);
  const group = result.groups[0];
  assert.deepEqual(
    {
      purchases: group.purchasesCents,
      refunds: group.refundsCents,
      net: group.netCents,
      purchaseCount: group.purchaseCount,
      refundCount: group.refundCount,
      zeroCount: group.zeroCount,
      share: group.sharePercent,
      evidenceCount: group.evidence.length
    },
    {
      purchases: 10030,
      refunds: 2000,
      net: 8030,
      purchaseCount: 3,
      refundCount: 1,
      zeroCount: 1,
      share: 100,
      evidenceCount: 5
    }
  );
  assert.deepEqual(
    [result.purchasesCents, result.refundsCents, result.netCents],
    [10030, 2000, 8030]
  );
});

test('compras 100 e estorno 20 mantêm participação de 100% com líquido 80', () => {
  const { groups } = available([
    transaction('1', { amount: 100 }),
    transaction('2', { amount: -20 })
  ]);
  assert.deepEqual(
    [
      groups[0].purchasesCents,
      groups[0].refundsCents,
      groups[0].netCents,
      groups[0].sharePercent
    ],
    [10000, 2000, 8000, 100]
  );
});

test('contas com mesmo nome e IDs distintos nunca são fundidas', () => {
  const { groups } = available([
    transaction('1', { accountId: 'bank-a', accountName: 'Conta corrente' }),
    transaction('2', { accountId: 'bank-b', accountName: 'Conta corrente' })
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((g) => g.accountKey),
    ['bank-a', 'bank-b']
  );
  assert.equal(groups[0].accountLabel, groups[1].accountLabel);
  assert.notEqual(groups[0].key, groups[1].key);
});

test('a tupla de conta e descrição não colide quando contém separadores', () => {
  const { groups } = available([
    transaction('1', { accountId: 'a:b', description: 'c' }),
    transaction('2', { accountId: 'a', description: 'b:c' })
  ]);
  assert.equal(groups.length, 2);
  assert.notEqual(groups[0].key, groups[1].key);
});

test('nome disponível da conta prevalece sobre ID e independe da ordem dos registros', () => {
  const items = [
    transaction('1', { accountId: '0001', accountName: undefined }),
    transaction('2', { accountId: '0001', accountName: 'Conta disponível' })
  ];
  const result = available(items);
  assert.equal(result.groups[0].accountLabel, 'Conta disponível');
  assert.deepEqual(available([...items].reverse()), result);
});

test('não normaliza caixa, acentos, parcelas, pontuação nem espaços', () => {
  const descriptions = [
    'CAFÉ',
    'Café',
    'Cafe',
    'CAFÉ (1/2)',
    'CAFÉ (2/2)',
    'CAFÉ!',
    ' CAFÉ',
    'CAFÉ '
  ];
  const { groups } = available(
    descriptions.map((description, index) =>
      transaction(String(index), { description })
    )
  );
  assert.equal(groups.length, descriptions.length);
  assert.deepEqual(
    new Set(groups.map((g) => g.description)),
    new Set(descriptions)
  );
});

test('preserva fallback existente da conta e rótulo manual sem inventar identidade', () => {
  const named = transaction('1', {
    accountId: undefined,
    accountName: 'Conta disponível'
  });
  const manual = transaction('2', {
    accountId: undefined,
    accountName: undefined
  });
  const idOnly = transaction('3', { accountName: undefined });
  assert.equal(concentrationAccountLabel(named), 'Conta disponível');
  assert.equal(concentrationAccountLabel(manual), 'Manual');
  assert.equal(concentrationAccountLabel(idOnly), 'account-a');
  const { groups } = available([named, manual]);
  assert.deepEqual(
    new Set(groups.map((g) => g.accountKey)),
    new Set(['Conta disponível', 'manual'])
  );
});

test('estorno com descrição diferente tem grupo próprio e não muda denominador', () => {
  const result = available([
    transaction('1', { description: 'A', amount: 100 }),
    transaction('2', { description: 'B', amount: 300 }),
    transaction('3', { description: 'ESTORNO A', amount: -200 })
  ]);
  assert.deepEqual(
    result.groups.map((g) => [g.description, g.sharePercent, g.netCents]),
    [
      ['B', 75, 30000],
      ['A', 25, 10000],
      ['ESTORNO A', 0, -20000]
    ]
  );
  assert.deepEqual(
    [result.purchasesCents, result.refundsCents, result.netCents],
    [40000, 20000, 20000]
  );
  assert.equal(
    result.groups.reduce((sum, group) => sum + group.sharePercent, 0),
    100
  );
});

test('só estornos preserva saldo negativo e participação indisponível', () => {
  const result = available([
    transaction('1', { amount: -30 }),
    transaction('2', { amount: -0.01 })
  ]);
  assert.equal(result.groups[0].sharePercent, null);
  assert.equal(result.groups[0].purchaseCount, 0);
  assert.equal(result.groups[0].refundCount, 2);
  assert.deepEqual(
    [result.purchasesCents, result.refundsCents, result.netCents],
    [0, 3001, -3001]
  );
});

test('zero não conta como compra nem estorno e mantém evidência', () => {
  const { groups } = available([
    transaction('1', { amount: 0 }),
    transaction('2', { amount: -0 })
  ]);
  assert.deepEqual(
    [groups[0].purchaseCount, groups[0].refundCount, groups[0].zeroCount],
    [0, 0, 2]
  );
  assert.equal(groups[0].evidence.length, 2);
  assert.equal(groups[0].sharePercent, null);
});

test('exclui renda, transferências, pendências, cancelados e outros meses; aceita Go e cloud', () => {
  const included = [
    transaction('posted'),
    transaction('paid', { status: 'PAID' })
  ];
  const ignored = [
    transaction('income', { kind: 'INCOME' }),
    transaction('transfer', { kind: 'TRANSFER' }),
    transaction('pending', { status: 'PENDING' }),
    transaction('cancelled', { status: 'CANCELLED' }),
    transaction('previous', { date: '2026-10-31' }),
    transaction('next', { date: '2026-12-01' })
  ];
  const result = available([...included, ...ignored]);
  assert.equal(result.groups[0].purchasesCents, 2000);
  assert.deepEqual(
    result.groups[0].evidence.map((t) => t.id),
    ['paid', 'posted']
  );
  for (const status of ['POSTED', 'PAID']) {
    assert.equal(
      available([transaction('1', { status })]).purchasesCents,
      1000
    );
  }
});

test('mês vazio e somente pendências são bases disponíveis sem grupos', () => {
  assert.deepEqual(available([]), {
    available: true,
    groups: [],
    purchasesCents: 0,
    refundsCents: 0,
    netCents: 0
  });
  assert.equal(
    available([transaction('1', { status: 'PENDING' })]).groups.length,
    0
  );
});

test('ordena por compras brutas, descrição e conta de forma determinística, sem mutação', () => {
  const items = [
    transaction('3', { description: 'B', amount: 20, accountId: 'b' }),
    transaction('2', { description: 'A', amount: 20, accountId: 'b' }),
    transaction('1', { description: 'A', amount: 20, accountId: 'a' }),
    transaction('4', { description: 'Z', amount: 30 }),
    transaction('5', { description: 'Z', amount: -100 })
  ];
  const original = structuredClone(items);
  const result = available(items);
  assert.deepEqual(
    result.groups.map((g) => [g.description, g.accountKey]),
    [
      ['Z', 'account-a'],
      ['A', 'a'],
      ['A', 'b'],
      ['B', 'b']
    ]
  );
  assert.deepEqual(available([...items].reverse()), result);
  assert.deepEqual(items, original);
});

test('cinco grupos iniciais e ver todos preservam acesso aos demais', () => {
  const { groups } = available(
    Array.from({ length: 8 }, (_, i) =>
      transaction(String(i), { description: `Grupo ${i}` })
    )
  );
  assert.equal(CONCENTRATION_GROUP_LIMIT, 5);
  assert.deepEqual(concentrationGroups(groups), groups.slice(0, 5));
  assert.deepEqual(concentrationGroups(groups, true), groups);
  assert.equal(groups.length, 8);
});

test('evidências ordenam data decrescente e ID estável; todas acessíveis em páginas de 20', () => {
  const items = Array.from({ length: 43 }, (_, i) =>
    transaction(String(i).padStart(2, '0'), {
      date: `2026-11-${String((i % 3) + 1).padStart(2, '0')}`
    })
  );
  const group = available(items).groups[0];
  const reversed = available([...items].reverse()).groups[0];
  assert.deepEqual(group.evidence, reversed.evidence);
  assert.equal(group.evidence[0].id, '02');
  assert.equal(group.evidence.at(-1).id, '42');
  assert.equal(CONCENTRATION_EVIDENCE_PAGE_SIZE, 20);
  const pages = [1, 2, 3].map((page) =>
    concentrationEvidencePage(group.evidence, page)
  );
  assert.deepEqual(
    pages.map((p) => [p.page, p.pages, p.items.length]),
    [
      [1, 3, 20],
      [2, 3, 20],
      [3, 3, 3]
    ]
  );
  assert.deepEqual(
    pages.flatMap((p) => p.items),
    group.evidence
  );
  for (const value of [0, -1, NaN, Infinity, 1.5])
    assert.equal(concentrationEvidencePage(group.evidence, value).page, 1);
  assert.equal(concentrationEvidencePage(group.evidence, 99).page, 3);
  assert.deepEqual(concentrationEvidencePage([], 20), {
    page: 1,
    pages: 1,
    items: []
  });
});

test('modo não configurado e meses inválidos ficam indisponíveis', () => {
  assert.deepEqual(
    spendingConcentration(dashboard([], { mode: 'unconfigured' })),
    { available: false, reason: 'unconfigured' }
  );
  for (const month of [
    '',
    '2026-1',
    '2026-00',
    '2026-13',
    '0000-01',
    '2026-11-01',
    null
  ]) {
    assert.deepEqual(spendingConcentration(dashboard([], { month })), {
      available: false,
      reason: 'invalid-month'
    });
  }
});

test('lista parcial e IDs duplicados não produzem totais enganosos', () => {
  const items = [transaction('same')];
  for (const total of [0, 2])
    assert.deepEqual(
      spendingConcentration(
        dashboard(items, { transactions: { items, total } })
      ),
      { available: false, reason: 'incomplete' }
    );
  assert.deepEqual(
    spendingConcentration(
      dashboard([
        transaction('same'),
        transaction('same', { date: '2026-10-01' })
      ])
    ),
    { available: false, reason: 'invalid-content' }
  );
});

test('rejeita conteúdo inválido em toda a lista, mesmo fora do recorte ou pendente', () => {
  const changes = [
    { id: '' },
    { id: ' ' },
    { date: '2026-11-31' },
    { date: '2026-02-29' },
    { date: 'inválida' },
    { amount: NaN },
    { amount: Infinity },
    { amount: '10' },
    { amount: Number.MAX_SAFE_INTEGER },
    { description: null },
    { status: null },
    { status: '' },
    { kind: 'OTHER' },
    { accountId: null },
    { accountName: 10 }
  ];
  for (const change of changes) {
    assert.deepEqual(
      spendingConcentration(dashboard([transaction('1', change)])),
      { available: false, reason: 'invalid-content' },
      JSON.stringify(change)
    );
  }
  assert.equal(
    available([transaction('leap', { date: '2024-02-29' })], {
      month: '2024-02'
    }).groups.length,
    1
  );
  assert.equal(spendingConcentration(dashboard([null])).available, false);
  assert.equal(
    spendingConcentration(
      dashboard([transaction('1', { date: '2026-10-01', amount: NaN })])
    ).available,
    false
  );
  assert.equal(
    spendingConcentration(
      dashboard([transaction('1', { status: 'PENDING', amount: NaN })])
    ).available,
    false
  );
});

test('metadados inválidos ou soma acima de centavos seguros bloqueiam análise', () => {
  for (const transactions of [
    null,
    { items: null, total: 0 },
    { items: [], total: -1 },
    { items: [], total: 1.5 }
  ]) {
    assert.deepEqual(spendingConcentration(dashboard([], { transactions })), {
      available: false,
      reason: 'invalid-content'
    });
  }
  for (const amount of [50000000000000, -50000000000000]) {
    assert.deepEqual(
      spendingConcentration(
        dashboard([transaction('1', { amount }), transaction('2', { amount })])
      ),
      { available: false, reason: 'invalid-content' }
    );
  }
});

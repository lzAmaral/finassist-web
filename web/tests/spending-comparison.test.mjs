import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareSpendingPeriods } from '../src/lib/spending-comparison.ts';

const transaction = (id, date, amount, extra = {}) => ({
  id,
  date,
  amount,
  kind: 'EXPENSE',
  status: 'POSTED',
  ...extra
});
const list = (items) => ({ items, total: items.length });
const dashboard = (items = [], extra = {}) => ({
  mode: 'live',
  month: '2026-11',
  transactions: list(items),
  ...extra
});
const previous = (items = [], month = '2026-10') => ({
  month,
  transactions: list(items)
});
const compare = (items, prior, extra = {}, reference = '2026-11-04') =>
  compareSpendingPeriods(dashboard(items, extra), previous(prior), reference);
const unavailable = (result, reason) => {
  assert.deepEqual(result, { status: 'unavailable', reason });
  assert.equal('current' in result, false);
  assert.equal('delta' in result, false);
};

test('soma centavos e usa diferença assinada sem erro binário', () => {
  const result = compare(
    [transaction('a', '2026-11-01', 0.1), transaction('b', '2026-11-01', 0.2)],
    [transaction('c', '2026-10-01', 0.1)]
  );
  assert.equal(result.status, 'available');
  assert.equal(result.current.amount, 0.3);
  assert.equal(result.delta, 0.2);
  assert.equal(result.percentage, 200);
});

test('aceita POSTED cloud e PAID Go; estorno reduz gasto e ignora outros tipos/status', () => {
  const result = compare(
    [
      transaction('compra', '2026-11-01', 100, { status: 'PAID' }),
      transaction('estorno', '2026-11-02', -20),
      transaction('pendente', '2026-11-02', 1000, { status: 'PENDING' }),
      transaction('cancelada', '2026-11-02', 1000, { status: 'CANCELED' }),
      transaction('renda', '2026-11-02', 5000, { kind: 'INCOME' }),
      transaction('transferencia', '2026-11-02', 5000, { kind: 'TRANSFER' })
    ],
    [transaction('anterior', '2026-10-01', 100)]
  );
  assert.equal(result.current.amount, 80);
  assert.equal(result.current.expenseCount, 2);
  assert.equal(result.previous.amount, 100);
  assert.equal(result.delta, -20);
  assert.equal(result.percentage, -20);
});

test('no dia 4 compara até o dia 4 inclusivo e restringe cada lista ao próprio mês', () => {
  const result = compare(
    [
      transaction('hoje', '2026-11-04', 50),
      transaction('futura', '2026-11-05', 500),
      transaction('fora', '2026-10-01', 500)
    ],
    [
      transaction('anterior', '2026-10-04', 25),
      transaction('posterior', '2026-10-05', 500),
      transaction('fora-anterior', '2026-09-01', 500)
    ]
  );
  assert.deepEqual(result.current, {
    start: '2026-11-01',
    end: '2026-11-04',
    amount: 50,
    expenseCount: 1
  });
  assert.deepEqual(result.previous, {
    start: '2026-10-01',
    end: '2026-10-04',
    amount: 25,
    expenseCount: 1
  });
  assert.equal(result.period, 'equivalent-days');
});

test('31 de março usa 28 dias nos dois meses e não inclui dias excedentes', () => {
  const result = compareSpendingPeriods(
    dashboard(
      [
        transaction('incluida', '2026-03-28', 10),
        transaction('excluida', '2026-03-29', 100)
      ],
      { month: '2026-03' }
    ),
    previous([transaction('fevereiro', '2026-02-28', 20)], '2026-02'),
    '2026-03-31'
  );
  assert.equal(result.current.end, '2026-03-28');
  assert.equal(result.previous.end, '2026-02-28');
  assert.equal(result.current.amount, 10);
});

test('fevereiro bissexto e virada janeiro/dezembro respeitam calendário', () => {
  const leap = compareSpendingPeriods(
    dashboard([transaction('marco', '2024-03-29', 20)], { month: '2024-03' }),
    previous([transaction('fevereiro', '2024-02-29', 10)], '2024-02'),
    '2024-03-31'
  );
  assert.equal(leap.current.end, '2024-03-29');
  assert.equal(leap.previous.end, '2024-02-29');
  const january = compareSpendingPeriods(
    dashboard([transaction('janeiro', '2026-01-01', 20)], { month: '2026-01' }),
    previous([transaction('dezembro', '2025-12-01', 10)], '2025-12'),
    '2026-01-04'
  );
  assert.equal(january.status, 'available');
  assert.equal(january.previous.end, '2025-12-04');
});

test('calendário gregoriano não trata ano secular como bissexto sem divisibilidade por 400', () => {
  for (const [year, end] of [
    ['2000', '29'],
    ['2100', '28']
  ]) {
    const result = compareSpendingPeriods(
      dashboard([], { month: `${year}-03` }),
      previous([], `${year}-02`),
      `${year}-03-31`
    );
    assert.equal(result.current.end, `${year}-03-${end}`);
    assert.equal(result.previous.end, `${year}-02-${end}`);
  }
});

test('consulta UTC no início do dia reduz o corte para o dia anterior em São Paulo', () => {
  const result = compare(
    [
      transaction('incluida', '2026-11-02', 20),
      transaction('excluida', '2026-11-03', 100)
    ],
    [transaction('outubro', '2026-10-02', 10)],
    {
      source: 'pluggy',
      syncedAt: '2026-11-03T01:30:00Z'
    }
  );
  assert.equal(result.consultedOn, '2026-11-02');
  assert.equal(result.current.end, '2026-11-02');
  assert.equal(result.previous.end, '2026-10-02');
  assert.equal(result.current.amount, 20);
  assert.equal(result.syncLimited, true);
});

test('consulta futura nunca avança corte; consulta no dia de referência não reduz corte', () => {
  for (const syncedAt of [
    '2026-11-10T12:00:00Z',
    '2026-11-04T12:00:00-03:00'
  ]) {
    const result = compare([], [], { source: 'pluggy', syncedAt });
    assert.equal(result.current.end, '2026-11-04');
    assert.equal(result.syncLimited, false);
  }
});

test('consulta anterior ao início do mês não gera queda artificial', () => {
  for (const syncedAt of ['2026-10-31T23:00:00Z', '2026-11-01T01:00:00Z']) {
    unavailable(compare([], [], { source: 'pluggy', syncedAt }), 'stale-sync');
  }
});

test('cloud corrente recusa sincronização ausente, inválida ou sem fuso explícito', () => {
  for (const syncedAt of [
    undefined,
    '',
    'invalid',
    '2026-11-02',
    '2026-11-02T12:00:00',
    '2026-02-30T12:00:00Z',
    '2026-11-02T25:00:00Z'
  ]) {
    unavailable(
      compare([], [], { source: 'pluggy', syncedAt }),
      'missing-sync'
    );
  }
});

test('seleção histórica compara meses completos mesmo com dias de duração diferente', () => {
  const result = compareSpendingPeriods(
    dashboard([transaction('ultimo-dia', '2026-03-31', 20)], {
      month: '2026-03',
      source: 'pluggy'
    }),
    previous([transaction('fevereiro', '2026-02-28', 10)], '2026-02'),
    '2026-11-04'
  );
  assert.equal(result.status, 'available');
  assert.equal(result.period, 'complete-months');
  assert.equal(result.current.end, '2026-03-31');
  assert.equal(result.previous.end, '2026-02-28');
  assert.equal(result.current.amount, 20);
  assert.equal(result.consultedOn, null);
});

test('seleção futura dispensa anterior e não retorna totais fictícios', () => {
  assert.deepEqual(
    compareSpendingPeriods(
      dashboard([], { month: '2026-12' }),
      null,
      '2026-11-04'
    ),
    { status: 'future' }
  );
});

test('anterior zero ou negativo preserva diferença sem percentual', () => {
  for (const amount of [0, -20]) {
    const result = compare(
      [transaction('atual', '2026-11-01', 40)],
      [transaction('anterior', '2026-10-01', amount)]
    );
    assert.equal(result.status, 'available');
    assert.equal(result.delta, 40 - amount);
    assert.equal(result.percentage, null);
  }
});

test('compras compensadas por estornos são base válida mesmo com total zero', () => {
  const result = compare(
    [
      transaction('compra', '2026-11-01', 100),
      transaction('estorno', '2026-11-01', -100)
    ],
    [transaction('anterior', '2026-10-01', 10)]
  );
  assert.equal(result.status, 'available');
  assert.equal(result.current.amount, 0);
  assert.equal(Object.is(result.current.amount, -0), false);
  assert.equal(result.percentage, -100);
  const priorZero = compare(
    [transaction('atual', '2026-11-01', 10)],
    [
      transaction('compra', '2026-10-01', 100),
      transaction('estorno', '2026-10-01', -100)
    ]
  );
  assert.equal(priorZero.status, 'available');
  assert.equal(priorZero.previous.expenseCount, 2);
  assert.equal(priorZero.percentage, null);
});

test('janela vazia ou sem despesas confirmadas é distinta de total zero registrado', () => {
  for (const [current, prior] of [
    [[], [transaction('anterior', '2026-10-01', 10)]],
    [[transaction('atual', '2026-11-01', 10)], []],
    [[], []],
    [
      [transaction('pendente', '2026-11-01', 50, { status: 'PENDING' })],
      [transaction('anterior', '2026-10-01', 10)]
    ],
    [
      [transaction('futura', '2026-11-05', 50)],
      [transaction('anterior', '2026-10-01', 10)]
    ]
  ]) {
    const result = compare(current, prior);
    assert.equal(result.status, 'empty');
    assert.equal(result.percentage, null);
    assert.equal(Number.isFinite(result.current.amount), true);
    assert.equal(Number.isFinite(result.previous.amount), true);
  }
});

test('anterior ausente não é convertido em lista vazia', () => {
  unavailable(
    compareSpendingPeriods(dashboard(), null, '2026-11-04'),
    'previous-unavailable'
  );
});

test('recusa modo sem dados, mês inválido, data inválida e mês anterior incorreto', () => {
  unavailable(compare([], [], { mode: 'unconfigured' }), 'configuration');
  for (const month of ['2026-13', '2026-1', 'invalid', '0000-01'])
    unavailable(compare([], [], { month }), 'invalid-month');
  for (const date of [
    '2026-02-29',
    '2026-11-31',
    '2026-11-00',
    '2026-11-4',
    'invalid',
    undefined
  ])
    unavailable(
      compareSpendingPeriods(dashboard(), previous(), date),
      'invalid-reference-date'
    );
  unavailable(
    compareSpendingPeriods(dashboard(), previous([], '2026-09'), '2026-11-04'),
    'previous-month'
  );
});

test('recusa listas ausentes ou parciais dos dois lados sem mostrar zero', () => {
  for (const invalid of [null, undefined, {}, { items: null, total: 0 }]) {
    unavailable(compare([], [], { transactions: invalid }), 'missing-list');
    unavailable(
      compareSpendingPeriods(
        dashboard(),
        { month: '2026-10', transactions: invalid },
        '2026-11-04'
      ),
      'missing-list'
    );
  }
  for (const invalid of [
    { items: [], total: 1 },
    { items: [], total: -1 },
    { items: [], total: '0' },
    { items: [], total: 0.5 },
    { items: [], total: undefined }
  ]) {
    unavailable(compare([], [], { transactions: invalid }), 'partial-list');
    unavailable(
      compareSpendingPeriods(
        dashboard(),
        { month: '2026-10', transactions: invalid },
        '2026-11-04'
      ),
      'partial-list'
    );
  }
});

test('IDs duplicados dentro de cada lista invalidam a base, IDs repetidos entre meses são independentes', () => {
  for (const side of ['current', 'previous']) {
    const duplicate = [
      transaction('a', side === 'current' ? '2026-11-01' : '2026-10-01', 10),
      transaction('a', '2026-10-02', 20)
    ];
    unavailable(
      compare(
        side === 'current' ? duplicate : [],
        side === 'previous' ? duplicate : []
      ),
      'duplicate-id'
    );
  }
  assert.equal(
    compare(
      [transaction('a', '2026-11-01', 10)],
      [transaction('a', '2026-10-01', 10)]
    ).status,
    'available'
  );
});

test('dados malformados nunca produzem NaN ou números fictícios', () => {
  for (const invalid of [
    null,
    transaction('', '2026-11-01', 10),
    transaction('a', '2026-11-31', 10),
    transaction('a', '2026-11-01', NaN),
    transaction('a', '2026-11-01', Infinity),
    transaction('a', '2026-11-01', '10'),
    transaction('a', '2026-11-01', Number.MAX_SAFE_INTEGER),
    transaction('a', '2026-11-01', 10, { kind: 'OTHER' }),
    transaction('a', '2026-11-01', 10, { status: null })
  ])
    unavailable(compare([invalid], []), 'invalid-transaction');
});

test('protege soma e diferença que ultrapassam precisão inteira segura', () => {
  const large = 60_000_000_000_000;
  unavailable(
    compare(
      [
        transaction('a', '2026-11-01', large),
        transaction('b', '2026-11-01', large)
      ],
      []
    ),
    'unsafe-total'
  );
  unavailable(
    compare(
      [transaction('a', '2026-11-01', large)],
      [transaction('b', '2026-10-01', -large)]
    ),
    'unsafe-total'
  );
});

test('helper é puro: não altera dashboard, anterior ou listas e depende apenas da referência recebida', () => {
  const current = dashboard([transaction('a', '2026-11-04', 10)]);
  const prior = previous([transaction('b', '2026-10-04', 5)]);
  const initial = structuredClone({ current, prior });
  assert.equal(
    compareSpendingPeriods(current, prior, '2026-11-03').status,
    'empty'
  );
  assert.equal(
    compareSpendingPeriods(current, prior, '2026-11-04').status,
    'available'
  );
  assert.deepEqual({ current, prior }, initial);
});

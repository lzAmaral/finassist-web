import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaDate, inAgendaWindow } from '../src/lib/card-agenda.ts';
import { cloudAgenda } from '../src/lib/server/card-agenda-data.ts';

test('agenda distingue sem data, vencidos e janelas inclusivas na virada do mês', () => {
  assert.equal(agendaDate(null), 'Não informada');
  assert.equal(agendaDate('2026-02-28'), '28/02/2026');
  assert.equal(
    inAgendaWindow({ dueDate: null }, 'undated', '2026-01-31'),
    true
  );
  assert.equal(
    inAgendaWindow({ dueDate: '2026-01-30' }, 'overdue', '2026-01-31'),
    true
  );
  assert.equal(
    inAgendaWindow({ dueDate: '2026-01-31' }, 'next7', '2026-01-31'),
    false
  );
  assert.equal(
    inAgendaWindow({ dueDate: '2026-02-07' }, 'next7', '2026-01-31'),
    true
  );
  assert.equal(
    inAgendaWindow({ dueDate: '2026-02-08' }, 'next7', '2026-01-31'),
    false
  );
  assert.equal(
    inAgendaWindow({ dueDate: '2026-03-02' }, 'next30', '2026-01-31'),
    true
  );
  assert.equal(
    inAgendaWindow({ dueDate: '2026-03-03' }, 'next30', '2026-01-31'),
    false
  );
});

test('cloud preserva saldo real e atualização sem inventar fatura, datas, limites ou obrigação', () => {
  const result = cloudAgenda(
    {
      syncedAt: '2026-10-21T15:00:00Z',
      items: [{ id: 'private-item', updatedAt: null }],
      accounts: [
        {
          id: 'bank',
          itemId: 'private-item',
          type: 'BANK',
          name: 'Conta',
          balance: 10000
        },
        {
          id: 'card',
          itemId: 'private-item',
          type: 'CREDIT',
          currencyCode: 'BRL',
          name: 'Cartão',
          balance: 0
        },
        {
          id: 'foreign',
          itemId: 'private-item',
          type: 'CREDIT',
          currencyCode: 'USD',
          name: 'Cartão USD',
          balance: 100
        },
        {
          id: 'unknown',
          itemId: 'private-item',
          type: 'CREDIT',
          name: 'Moeda desconhecida',
          balance: 200
        }
      ],
      transactions: [
        { description: 'Compra ou pagamento de fatura', amount: 100 }
      ]
    },
    new Date('2026-11-01T01:30:00Z')
  );
  assert.equal(result.today, '2026-10-31');
  assert.equal(result.agendaAvailable, false);
  assert.equal(result.cards.length, 1);
  assert.equal(result.excludedCurrencies, 2);
  assert.equal(result.cards[0].debtBalance, 0);
  for (const key of [
    'invoice',
    'dueDate',
    'closeDate',
    'creditLimit',
    'availableCreditLimit',
    'sourceUpdatedAt'
  ])
    assert.equal(result.cards[0][key], null);
  assert.deepEqual(result.commitments, []);
  assert.match(result.unavailableReason, /backend Go/);
  assert.doesNotMatch(JSON.stringify(result), /private-item/);
});

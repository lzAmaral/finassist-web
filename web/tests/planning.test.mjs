import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import {
  currentPlanningMonth,
  goalStatus,
  planningRequest,
  projectedRemainder,
  validateGoal
} from '../src/lib/planning.ts';

const now = new Date('2026-10-21T12:00:00Z');
test('meta valida centavos, mês futuro, limites e campos específicos dos três tipos', () => {
  assert.equal(currentPlanningMonth(now), '2026-10');
  assert.equal(
    validateGoal(
      {
        kind: 'SAVE',
        name: 'Viagem',
        targetAmount: 1234.56,
        targetDate: '2027-04'
      },
      now
    ),
    ''
  );
  for (const draft of [
    { kind: 'SAVE', name: '', targetAmount: 100, targetDate: '2027-04' },
    { kind: 'SAVE', name: 'Viagem', targetAmount: NaN, targetDate: '2027-04' },
    { kind: 'SAVE', name: 'Viagem', targetAmount: 0, targetDate: '2027-04' },
    { kind: 'SAVE', name: 'Viagem', targetAmount: 100, targetDate: '2026-10' },
    { kind: 'SAVE', name: 'Viagem', targetAmount: 100, targetDate: '2036-11' },
    { kind: 'CUT', name: 'Comida', category: 'FOOD', cutPercent: 15.5 },
    { kind: 'CUT', name: 'Comida', category: 'FOOD', cutPercent: 91 },
    { kind: 'RESERVE', name: 'Reserva', reserveMonths: 0 },
    { kind: 'RESERVE', name: 'Reserva', reserveMonths: 37 }
  ])
    assert.notEqual(validateGoal(draft, now), '');
  assert.equal(
    validateGoal(
      { kind: 'CUT', name: 'Comida', category: 'FOOD', cutPercent: 15 },
      now
    ),
    ''
  );
  assert.equal(
    validateGoal({ kind: 'RESERVE', name: 'Reserva', reserveMonths: 6 }, now),
    ''
  );
});

test('status distingue prazo vencido, mês aberto, reserva sem base e conclusão', () => {
  assert.equal(
    goalStatus({ kind: 'SAVE', done: false, targetDate: '2026-09' }, '2026-10'),
    'Prazo vencido'
  );
  assert.equal(
    goalStatus({ kind: 'SAVE', done: false, targetDate: '2026-10' }, '2026-10'),
    'Prazo neste mês'
  );
  assert.equal(
    goalStatus({ kind: 'SAVE', done: true, targetDate: '2026-09' }, '2026-10'),
    'Objetivo alcançado'
  );
  assert.equal(
    goalStatus({ kind: 'CUT', current: 600, target: 800, done: false }),
    'Dentro do teto até agora'
  );
  assert.equal(
    goalStatus({ kind: 'CUT', current: 900, target: 800, done: false }),
    'Teto ultrapassado'
  );
  assert.equal(
    goalStatus({ kind: 'RESERVE', current: 900, target: 0, done: false }),
    'Sem base de despesas fixas'
  );
});

test('sobra utiliza premissas Go sem confundir zero de renda com histórico ausente', () => {
  const month = {
    month: '2026-10',
    fixed: 1000,
    variable: 500,
    installment: 250
  };
  assert.equal(
    projectedRemainder({ assumptions: { basedOn: 0, income: 0 } }, month),
    null
  );
  assert.equal(
    projectedRemainder({ assumptions: { basedOn: 1, income: 0 } }, month),
    -1750
  );
  assert.equal(
    projectedRemainder({ assumptions: { basedOn: 3, income: 3000 } }, month),
    1250
  );
});

test('cliente persiste payload dos três tipos, relê metas e exclui por ID sem sucesso falso', async () => {
  const goals = new Map();
  let rule;
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/goals' && req.method === 'POST') {
      if (!body.name) {
        res
          .writeHead(400)
          .end(JSON.stringify({ error: 'name deve ter de 1 a 60 caracteres' }));
        return;
      }
      const id = `${goals.size + 1}`;
      goals.set(id, { id, ...body });
      res.writeHead(201).end(JSON.stringify({ id }));
    } else if (req.url === '/api/goals')
      res.end(JSON.stringify({ wealth: 500, goals: [...goals.values()] }));
    else if (req.method === 'DELETE') {
      goals.delete(req.url.split('/').at(-1));
      res.end('{"ok":true}');
    } else if (req.url === '/api/expense-rules') {
      rule = body;
      res.end('{"ok":true}');
    } else {
      res.writeHead(502).end('indisponível');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = (path) => `http://127.0.0.1:${server.address().port}${path}`;
  try {
    for (const draft of [
      {
        kind: 'SAVE',
        name: 'Viagem',
        targetAmount: 1234.56,
        targetDate: '2027-04'
      },
      { kind: 'CUT', name: 'Comida', category: 'FOOD', cutPercent: 20 },
      { kind: 'RESERVE', name: 'Reserva', reserveMonths: 6 }
    ]) {
      const { id } = await planningRequest(url('/api/goals'), 'POST', draft);
      const reload = await planningRequest(url('/api/goals'));
      assert.deepEqual(
        reload.goals.find((goal) => goal.id === id),
        { id, ...draft }
      );
    }
    await planningRequest(url('/api/expense-rules'), 'PUT', {
      key: 'internet',
      class: 'FIXED'
    });
    assert.deepEqual(rule, { key: 'internet', class: 'FIXED' });
    await planningRequest(url('/api/expense-rules'), 'PUT', {
      key: 'internet',
      class: 'AUTO'
    });
    assert.equal(rule.class, 'AUTO');
    await planningRequest(url('/api/goals/2'), 'DELETE');
    assert.deepEqual(
      (await planningRequest(url('/api/goals'))).goals.map((g) => g.id),
      ['1', '3']
    );
    await assert.rejects(
      planningRequest(url('/api/goals'), 'POST', { name: '' }),
      /name deve/
    );
    await assert.rejects(
      planningRequest(url('/api/unavailable')),
      /Não foi possível/
    );
    assert.equal((await planningRequest(url('/api/goals'))).goals.length, 2);
  } finally {
    server.close();
    server.closeAllConnections();
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ManualEntrySession,
  isManualDate,
  loadManualAccounts,
  manualAccountLabel,
  manualPendingKey,
  parseManualAmount,
  postManualEntry,
  prepareManualPayload
} from '../src/lib/manual-entry.ts';

const requestId = 'c6a172aa-ed53-4c84-9068-2a2205e823fd';
const accountId = 'e9c256ea-7bc6-4ffb-8e99-289cfb5f81bd';
const paymentId = 'b094faba-46b2-43e7-ac96-6cc4806a6490';
const purchaseId = '66f76143-d024-49cf-a4b7-43a95a9f2ce1';
const accounts = [{ id: accountId, type: 'BANK', name: 'Conta local' }];
const fields = {
  amount: '1.234,56',
  date: '2026-10-31',
  description: ' Compra sintética ',
  accountId,
  category: 'MARKET',
  paymentMethod: 'PIX'
};
const payload = () =>
  prepareManualPayload(fields, accounts, '2026-11-04', requestId);
function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key)
  };
}
function confirmed(body, replayed = false) {
  return Response.json(
    {
      id: paymentId,
      purchaseId,
      requestId: body.requestId,
      date: body.date,
      amountCents: body.amountCents,
      replayed
    },
    { status: replayed ? 200 : 201 }
  );
}

test('Brazilian amounts retain exact cents, including the ledger limit', () => {
  for (const [input, cents] of [
    ['0,01', 1],
    ['1.234,56', 123456],
    [' 12,3 ', 1230],
    ['9.999.999.999,99', 999999999999],
    ['42', 4200]
  ]) {
    assert.equal(parseManualAmount(input), cents);
  }
  for (const input of [
    '0',
    '0,00',
    '-1',
    '1,001',
    '1.23',
    '1,234.56',
    '1e3',
    'NaN',
    '10.000.000.000,00',
    '9'.repeat(1000),
    '1..000',
    '+1',
    'R$ 1,00'
  ]) {
    assert.equal(parseManualAmount(input), null, input);
  }
});

test('civil dates use the supplied São Paulo day, with valid leap days and month boundaries', () => {
  assert.equal(isManualDate('2024-02-29'), true);
  for (const date of [
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '0000-01-01',
    '2026-1-01',
    '2026-11-04T00:00:00Z'
  ])
    assert.equal(isManualDate(date), false, date);
  assert.equal(payload().date, '2026-10-31');
  assert.throws(
    () =>
      prepareManualPayload(
        { ...fields, date: '1999-12-31' },
        accounts,
        '2026-11-04',
        requestId
      ),
    /desde 01\/01\/2000/
  );
  assert.equal(
    prepareManualPayload(
      { ...fields, date: '2000-01-01' },
      accounts,
      '2026-11-04',
      requestId
    ).date,
    '2000-01-01'
  );
  assert.throws(
    () =>
      prepareManualPayload(
        { ...fields, date: '2026-11-05' },
        accounts,
        '2026-11-04',
        requestId
      ),
    /data válida/
  );
  assert.equal(
    prepareManualPayload(
      { ...fields, date: '2026-11-01' },
      accounts,
      '2026-11-01',
      requestId
    ).date,
    '2026-11-01'
  );
});

test('account labels include last four digits and disambiguate otherwise identical accounts', () => {
  const first = { ...accounts[0], last4: '1234' };
  const second = { ...first, id: paymentId };
  assert.equal(manualAccountLabel(first, [first]), 'Conta local · final 1234');
  assert.notEqual(
    manualAccountLabel(first, [first, second]),
    manualAccountLabel(second, [first, second])
  );
  const sharedPrefix = { ...first, id: first.id.slice(0, -1) + 'a' };
  assert.notEqual(
    manualAccountLabel(first, [first, sharedPrefix]),
    manualAccountLabel(sharedPrefix, [first, sharedPrefix])
  );
});

test('payload normalizes description, requires an explicit eligible account and rejects unsupported enums', () => {
  assert.equal(payload().description, 'Compra sintética');
  assert.equal(Object.isFrozen(payload()), true);
  for (const patch of [
    { accountId: '' },
    { accountId: paymentId },
    { category: 'INCOME' },
    { paymentMethod: 'CREDIT_CARD' },
    { description: ' ' },
    { description: 'a'.repeat(201) }
  ]) {
    assert.throws(() =>
      prepareManualPayload(
        { ...fields, ...patch },
        accounts,
        '2026-11-04',
        requestId
      )
    );
  }
  assert.throws(() =>
    prepareManualPayload(
      fields,
      [{ ...accounts[0], type: 'CREDIT' }],
      '2026-11-04',
      requestId
    )
  );
  assert.equal(
    prepareManualPayload(
      { ...fields, description: '🧾'.repeat(200) },
      accounts,
      '2026-11-04',
      requestId
    ).description.length,
    400
  );
});

test('accounts endpoint filters CREDIT and malformed entries without selecting the first BANK', async () => {
  const banks = await loadManualAccounts(async (path, options) => {
    assert.equal(path, '/api/accounts');
    assert.equal(options.redirect, 'error');
    return Response.json([
      null,
      { ...accounts[0], type: 'CREDIT' },
      { ...accounts[0], id: 'invalid' },
      ...accounts
    ]);
  });
  assert.deepEqual(banks, accounts);
  await assert.rejects(
    loadManualAccounts(async () => Response.json({ accounts })),
    /carregar as contas/
  );
});

test('POST sends only the contract and validates actual persisted receipt data', async () => {
  const body = payload();
  const receipt = await postManualEntry(body, async (path, options) => {
    assert.equal(path, '/api/transactions/manual');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), body);
    return confirmed(body);
  });
  assert.equal(receipt.id, paymentId);
  for (const response of [
    Response.json({}),
    Response.json({ ...receipt, amountCents: 1 }, { status: 201 }),
    Response.json({ ...receipt, date: '2026-11-01' }, { status: 201 }),
    Response.json({ ...receipt, requestId: paymentId }, { status: 201 }),
    Response.json({ ...receipt, id: 'invalid' }, { status: 201 }),
    Response.json({ ...receipt, replayed: true }, { status: 201 }),
    new Response('<html>login</html>', { status: 200 }),
    new Response(null, { status: 204 })
  ])
    await assert.rejects(
      postManualEntry(body, async () => response),
      /confirm/
    );
});

test('raw API and network errors never reach the interface', async () => {
  await assert.rejects(
    postManualEntry(payload(), async () =>
      Response.json({ error: 'password=secret' }, { status: 500 })
    ),
    (error) => !error.message.includes('secret')
  );
  await assert.rejects(
    postManualEntry(payload(), async () => {
      throw new Error('token=secret');
    }),
    (error) =>
      error.message.includes('incerto') && !error.message.includes('secret')
  );
});

test('lost response followed by reload retries an identical frozen payload and key', async () => {
  const store = storage(),
    calls = [];
  const session = new ManualEntrySession(store, async (_path, options) => {
    calls.push(options.body);
    assert.deepEqual(
      JSON.parse(store.getItem(manualPendingKey)).payload,
      payload()
    );
    throw new TypeError('conexão interrompida');
  });
  await session.submit(payload());
  assert.equal(session.receipt, null);
  assert.match(session.error, /incerto/);
  assert.equal(Object.isFrozen(session.pending), true);
  session.startAnother();
  assert.notEqual(session.pending, null);
  const resumed = new ManualEntrySession(store, async (_path, options) => {
    calls.push(options.body);
    return confirmed(JSON.parse(options.body), true);
  });
  await assert.rejects(
    resumed.submit({ ...payload(), description: 'Outra compra' }),
    /mesmos dados/
  );
  await resumed.submit();
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
  assert.equal(resumed.receipt.replayed, true);
  assert.equal(resumed.receipt.id, paymentId);
  assert.equal(store.getItem(manualPendingKey), null);
});

test('double confirmation and failed refresh cannot repeat a confirmed write', async () => {
  const store = storage();
  let release,
    calls = 0,
    refreshes = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const session = new ManualEntrySession(store, async (_path, options) => {
    calls++;
    await gate;
    return confirmed(JSON.parse(options.body));
  });
  const first = session.submit(payload(), async (date) => {
    refreshes++;
    assert.equal(date, fields.date);
    throw new Error('refresh falhou');
  });
  const duplicate = session.submit(payload());
  assert.equal(session.saving, true);
  assert.notEqual(store.getItem(manualPendingKey), null);
  release();
  await Promise.all([first, duplicate]);
  assert.equal(calls, 1);
  assert.equal(refreshes, 1);
  assert.equal(session.receipt.id, paymentId);
  assert.equal(session.error, '');
  assert.match(session.refreshError, /foi salva/);
  assert.equal(store.getItem(manualPendingKey), null);
  await session.submit(payload());
  assert.equal(calls, 1);
});

test('a malformed success response preserves pending data for a safe replay', async () => {
  const store = storage();
  const session = new ManualEntrySession(store, async () =>
    Response.json({ ok: true })
  );
  await session.submit(payload());
  assert.equal(session.receipt, null);
  assert.deepEqual(session.pending, payload());
  assert.notEqual(store.getItem(manualPendingKey), null);
});

test('initial 400 permits correction; 400 after uncertainty and 409 retain the frozen attempt', async () => {
  const store = storage();
  const first = new ManualEntrySession(store, async () =>
    Response.json({}, { status: 400 })
  );
  await first.submit(payload());
  assert.equal(first.pending, null);
  assert.equal(store.getItem(manualPendingKey), null);
  store.setItem(
    manualPendingKey,
    JSON.stringify({ version: 1, payload: payload() })
  );
  for (const status of [400, 409, 503]) {
    const resumed = new ManualEntrySession(store, async () =>
      Response.json({}, { status })
    );
    await resumed.submit();
    assert.deepEqual(resumed.pending, payload());
    assert.equal(resumed.receipt, null);
    assert.notEqual(store.getItem(manualPendingKey), null);
  }
});

test('corrupt pending or unavailable session reads block a fresh write', async () => {
  for (const raw of [
    'not JSON',
    JSON.stringify({ version: 1, payload: { ...payload(), kind: 'INCOME' } }),
    JSON.stringify({ version: 1, payload: { ...payload(), amountCents: 1.5 } })
  ]) {
    const store = storage();
    store.setItem(manualPendingKey, raw);
    const session = new ManualEntrySession(store, async () =>
      assert.fail('não deve enviar')
    );
    assert.equal(session.blocked, true);
    await session.submit(payload());
    assert.equal(store.getItem(manualPendingKey), raw);
  }
  const session = new ManualEntrySession(null, async () =>
    assert.fail('não deve enviar')
  );
  await session.submit(payload());
  assert.equal(session.blocked, true);
});

test('failed storage writes warn honestly while retaining the in-page retry', async () => {
  const store = storage();
  store.setItem = () => {
    throw new Error('quota');
  };
  const session = new ManualEntrySession(store, async () => {
    throw new TypeError('offline');
  });
  await session.submit(payload());
  assert.match(
    session.storageWarning,
    /retomada após recarregar não está protegida/
  );
  assert.deepEqual(session.pending, payload());
  assert.equal(store.getItem(manualPendingKey), null);
});

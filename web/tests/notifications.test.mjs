import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maskNotification,
  notificationDelivery,
  validateNotificationPreferences,
  notificationsRequest
} from '../src/lib/notifications.ts';

const preferences = {
  hour: 9,
  minute: 30,
  weekday: 1,
  timeZone: 'America/Sao_Paulo',
  hideAmounts: true,
  telegram: false,
  types: { weekly_digest: true, review: true, goals: true, reminders: true }
};
test('privacidade oculta valores inclusive negativos e preserva datas', () => {
  assert.equal(
    maskNotification(
      'Valor R$ 1.234,56; estorno R$ -20,00; dia 21/10/2026.',
      true
    ),
    'Valor R$ ••••••; estorno R$ ••••••; dia 21/10/2026.'
  );
  assert.equal(maskNotification('R$ 1,00', false), 'R$ 1,00');
});
test('preferências validam fuso e horário', () => {
  assert.equal(validateNotificationPreferences(preferences), '');
  assert.match(
    validateNotificationPreferences({
      ...preferences,
      timeZone: 'Invalid/Zone'
    }),
    /fuso/
  );
  assert.match(
    validateNotificationPreferences({ ...preferences, hour: 24 }),
    /horário/
  );
  assert.match(
    validateNotificationPreferences({ ...preferences, minute: NaN }),
    /horário/
  );
});
test('entrega incerta e retentativa não prometem sucesso', () => {
  assert.match(
    notificationDelivery({
      deliveryStatus: 'failed',
      lastError: 'delivery_uncertain',
      attempts: 1
    }),
    /não será repetido/
  );
  assert.match(
    notificationDelivery({ deliveryStatus: 'retry', attempts: 2 }),
    /2\/3/
  );
});
test('requisição mantém erro explícito e envia JSON nas escritas', async () => {
  const previous = global.fetch;
  try {
    global.fetch = async (_path, init) => {
      assert.equal(init.headers['Content-Type'], 'application/json');
      assert.equal(init.method, 'PUT');
      return new Response(
        JSON.stringify({ error: 'persistência indisponível' }),
        { status: 503 }
      );
    };
    await assert.rejects(
      () =>
        notificationsRequest(
          '/api/notifications/preferences',
          'PUT',
          preferences
        ),
      /persistência indisponível/
    );
  } finally {
    global.fetch = previous;
  }
});

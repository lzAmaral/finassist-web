import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadQuestion,
  questionChoices,
  questionRequest,
  questionStatus
} from '../src/lib/questions.ts';

test('perguntas prontas usam somente consultas GET e argumentos delimitados sem IA', async () => {
  const calls = [];
  const fetcher = async (path, options) => {
    calls.push({ path, options });
    return Response.json({ kind: 'category_total', periods: [] });
  };
  for (const choice of questionChoices)
    await loadQuestion(choice.kind, '2026-10', 'FOOD', fetcher);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    const url = new URL(call.path, 'https://app.invalid');
    assert.equal(url.pathname, '/api/questions');
    assert.equal(url.searchParams.get('month'), '2026-10');
    assert.equal(call.options.cache, 'no-store');
    assert.equal(call.options.method, undefined);
    assert.equal(
      url.searchParams.has('category'),
      url.searchParams.get('kind') === 'category_total'
    );
  }
});
test('erros mantêm sessão, indisponibilidade e limite explícitos sem sucesso falso', async () => {
  for (const status of [401, 429, 500, 501, 503]) {
    await assert.rejects(
      questionRequest('/api/questions', async () =>
        Response.json({ error: 'indisponível' }, { status })
      ),
      status === 401 ? /sessão expirou/ : /indisponível/
    );
  }
  await assert.rejects(
    questionRequest(
      '/api/questions',
      async () => new Response('não json', { status: 502 })
    ),
    /Não foi possível/
  );
  assert.notEqual(questionStatus.no_data, questionStatus.no_matches);
  assert.match(questionStatus.insufficient_data, /não equivale a gasto zero/);
});

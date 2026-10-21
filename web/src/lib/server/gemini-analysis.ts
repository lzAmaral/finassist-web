import { createHash } from 'node:crypto';
import { GEMINI_API_KEY, GEMINI_MODEL } from '$app/env/private';
import { readPrivate, writePrivate } from './private-store.js';
import { anonymousIndicators } from '../analysis.js';
import type { GeminiAnalysis } from '../analysis.js';
import type { Dashboard } from '../finance.js';
import { ValidationError } from './portfolio-data.js';

interface AIState {
  version: 1;
  key?: string;
  analysis?: GeminiAnalysis;
  analysisMonth?: string;
  fingerprint?: string;
  usage?: { day: string; count: number };
}
const path = 'finance/analysis-v1.enc';
async function read() {
  const stored = await readPrivate<AIState>(path);
  if (stored && stored.value.version !== 1)
    throw new Error('Configuração de análise inválida.');
  return stored;
}
export async function aiStatus(month: string) {
  const state = (await read())?.value;
  return {
    configured: !!(GEMINI_API_KEY || state?.key),
    analysis: state?.analysisMonth === month ? (state.analysis ?? null) : null,
    model: GEMINI_MODEL || 'gemini-3.8-flash'
  };
}
export async function saveAIKey(input: unknown) {
  const key = typeof input === 'string' ? input.trim() : '';
  if (!/^AIza[A-Za-z0-9_-]{20,150}$/.test(key))
    throw new ValidationError(
      'Cole uma chave Gemini válida do Google AI Studio.'
    );
  const stored = await read();
  await writePrivate(path, { ...stored?.value, version: 1, key }, stored?.etag);
}
export async function generateAnalysis(
  dashboard: Dashboard
): Promise<GeminiAnalysis> {
  const stored = await read();
  const state: AIState = stored?.value ?? { version: 1 };
  const key = GEMINI_API_KEY || state.key;
  if (!key)
    throw new ValidationError(
      'Configure sua chave Gemini para ativar a análise por IA.'
    );
  const payload = anonymousIndicators(dashboard);
  const fingerprint = createHash('sha256')
    .update(dashboard.month + JSON.stringify(payload))
    .digest('hex');
  if (
    state.fingerprint === fingerprint &&
    state.analysis &&
    Date.now() - Date.parse(state.analysis.generatedAt) < 24 * 3600_000
  )
    return state.analysis;
  const day = new Date().toISOString().slice(0, 10);
  const count = state.usage?.day === day ? state.usage.count : 0;
  if (count >= 10)
    throw new ValidationError(
      'Limite de 10 análises por dia atingido. Tente amanhã.'
    );
  state.usage = { day, count: count + 1 };
  const reservation = await writePrivate(path, state, stored?.etag);
  const model = GEMINI_MODEL || 'gemini-3.8-flash';
  if (!/^[a-z0-9.-]+$/.test(model)) throw new Error('Modelo Gemini inválido.');
  const schema = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      observations: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      actions: { type: 'array', items: { type: 'string' }, maxItems: 4 }
    },
    required: ['summary', 'observations', 'actions'],
    additionalProperties: false
  };
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: 'Você ajuda a compreender hábitos de orçamento em português do Brasil. Recebe SOMENTE índices e percentuais desidentificados, sem extratos ou valores monetários. Faça observações curtas baseadas nesses números e proponha ações práticas para revisar despesas. Não invente valores, renda, metas, despesas específicas ou períodos calendários. A comparação com período anterior pode ser parcial; sinalize essa limitação. Não recomende ativos, compra, venda ou promessas de retorno. Não emita diagnóstico financeiro. Responda no formato JSON solicitado, em até 180 palavras.'
            }
          ]
        },
        contents: [
          { role: 'user', parts: [{ text: JSON.stringify(payload) }] }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          maxOutputTokens: 2000
        }
      })
    }
  );
  if (!response.ok) {
    if (response.status === 429)
      throw new ValidationError(
        'A cota Gemini está temporariamente esgotada. Os gráficos e a análise local continuam disponíveis.'
      );
    if ([400, 401, 403].includes(response.status))
      throw new ValidationError(
        'O Google recusou a configuração. Confira sua chave e o acesso ao modelo no AI Studio.'
      );
    throw new Error('O Gemini está indisponível. Tente novamente mais tarde.');
  }
  const result = await response.json();
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== 'STOP')
    throw new Error('O Gemini não concluiu a análise. Tente novamente.');
  const content = JSON.parse(
    candidate.content.parts
      .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text)
      .join('')
  );
  const validStrings = (value: unknown) =>
    Array.isArray(value) &&
    value.length <= 4 &&
    value.every((v) => typeof v === 'string' && v.length <= 1000);
  if (
    typeof content.summary !== 'string' ||
    content.summary.length > 2000 ||
    !validStrings(content.observations) ||
    !validStrings(content.actions)
  )
    throw new Error('O Gemini respondeu com uma análise inválida.');
  const analysis: GeminiAnalysis = {
    ...content,
    model,
    generatedAt: new Date().toISOString()
  };
  await writePrivate(
    path,
    { ...state, analysis, fingerprint, analysisMonth: dashboard.month },
    reservation.etag
  );
  return analysis;
}

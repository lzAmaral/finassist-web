import { createHash } from 'node:crypto';

export const companionPaths = [
  'finance/portfolio-v1.enc',
  'finance/analysis-v1.enc'
] as const;
type Stored = { value: unknown; etag: string };
export type MigrationStore = {
  read: (path: string) => Promise<Stored | undefined>;
  create: (path: string, value: unknown) => Promise<void>;
};
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

// O pacote contém segredos: só o manifesto (hash/contagens), nunca o conteúdo, pode ir para logs.
export async function exportCompanion(source: MigrationStore) {
  const documents = [];
  for (const path of companionPaths) {
    const stored = await source.read(path);
    if (stored)
      documents.push({
        path,
        value: structuredClone(stored.value),
        etag: stored.etag,
        hash: hash(stored.value)
      });
  }
  const portfolio = documents.find((d) => d.path === companionPaths[0])
    ?.value as { positions?: unknown[]; dividends?: unknown[] } | undefined;
  return {
    version: 1 as const,
    documents,
    counts: {
      positions: portfolio?.positions?.length ?? 0,
      dividends: portfolio?.dividends?.length ?? 0,
      ai: documents.some((d) => d.path === companionPaths[1]) ? 1 : 0
    }
  };
}

export async function importCompanion(
  bundle: Awaited<ReturnType<typeof exportCompanion>>,
  source: MigrationStore,
  target: MigrationStore
) {
  // Validar todo o inventário antes da primeira escrita reduz migrações parciais.
  for (const document of bundle.documents) {
    if (
      !companionPaths.includes(document.path) ||
      hash(document.value) !== document.hash
    )
      throw new Error('pacote de migração inválido');
    const current = await source.read(document.path);
    if (!current || current.etag !== document.etag)
      throw new Error('origem alterada durante a migração');
    const existing = await target.read(document.path);
    if (existing && hash(existing.value) !== document.hash)
      throw new Error('destino contém dados divergentes');
  }
  let created = 0;
  for (const document of bundle.documents) {
    if (!(await target.read(document.path))) {
      // create deve recusar documento existente atomicamente (Blob sem allowOverwrite).
      await target.create(document.path, document.value);
      created++;
    }
    const saved = await target.read(document.path);
    if (!saved || hash(saved.value) !== document.hash)
      throw new Error('verificação do destino falhou');
  }
  return {
    created,
    unchanged: bundle.documents.length - created,
    counts: bundle.counts
  };
}

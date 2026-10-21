import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { cloudConfig } from './cloud-config.js';
import type { Snapshot } from './finance-data.js';

const path = 'finance/snapshot-v1.enc';
let cached: { value: Snapshot; etag: string; expires: number } | undefined;
export async function readSnapshot(fresh = false) {
  if (!fresh && cached && cached.expires > Date.now()) return cached;
  const c = cloudConfig();
  const result = await get(path, {
    access: 'private',
    token: c.blobToken,
    useCache: false
  });
  if (!result) return undefined;
  if (result.statusCode !== 200)
    throw new Error('Falha ao ler a sincronização.');
  const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(c.dataKey!, 'hex'),
    bytes.subarray(0, 12)
  );
  decipher.setAuthTag(bytes.subarray(12, 28));
  const value = JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final()
    ]).toString()
  ) as Snapshot;
  if (
    value.version !== 1 ||
    !Array.isArray(value.accounts) ||
    !Array.isArray(value.transactions)
  )
    throw new Error('Sincronização inválida.');
  cached = { value, etag: result.blob.etag, expires: Date.now() + 30_000 };
  return cached;
}
export async function writeSnapshot(value: Snapshot, etag?: string) {
  const c = cloudConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(c.dataKey!, 'hex'),
    iv
  );
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final()
  ]);
  const result = await put(
    path,
    Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
    {
      access: 'private',
      token: c.blobToken,
      addRandomSuffix: false,
      ...(etag ? { ifMatch: etag } : {}),
      contentType: 'application/octet-stream',
      cacheControlMaxAge: 60
    }
  );
  cached = { value, etag: result.etag, expires: Date.now() + 30_000 };
}

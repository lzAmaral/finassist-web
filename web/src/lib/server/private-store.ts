import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { cloudConfig } from './cloud-config.js';

function scoped(path: string) {
  const namespace = cloudConfig().privateNamespace;
  if (!namespace) return path;
  if (!/^[a-z0-9-]{1,60}$/.test(namespace))
    throw new Error('Namespace inválido.');
  return `${namespace}/${path}`;
}

export async function readPrivate<T>(path: string) {
  path = scoped(path);
  const c = cloudConfig();
  const result = await get(path, {
    access: 'private',
    token: c.blobToken,
    useCache: false,
    headers: { 'accept-encoding': 'identity' }
  });
  if (!result) return undefined;
  if (result.statusCode !== 200)
    throw new Error('Falha ao ler os dados privados.');
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
  ) as T;
  return { value, etag: result.blob.etag };
}
export async function writePrivate<T>(path: string, value: T, etag?: string) {
  path = scoped(path);
  const c = cloudConfig(),
    iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(c.dataKey!, 'hex'),
    iv
  );
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final()
  ]);
  return put(path, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), {
    access: 'private',
    token: c.blobToken,
    addRandomSuffix: false,
    ...(etag ? { ifMatch: etag } : {}),
    contentType: 'application/octet-stream',
    cacheControlMaxAge: 60
  });
}

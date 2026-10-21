import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Cookies } from '@sveltejs/kit';
import { cloudConfig } from './cloud-config.js';

const derive = promisify(scrypt);
const cookie = 'fa_cloud_session';
const ttl = 7 * 86400;
const failures = new Map<string, { count: number; until: number }>();
function signature(value: string) {
  const c = cloudConfig();
  if (!c.sessionKey || !c.passwordHash)
    throw new Error('Acesso não configurado.');
  return createHmac('sha256', c.sessionKey)
    .update(`${c.passwordHash}:${value}`)
    .digest('hex');
}
function equal(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function authenticated(cookies: Cookies) {
  const value = cookies.get(cookie);
  if (!value) return false;
  const [expiry, nonce, sig, extra] = value.split('.');
  const time = Number(expiry);
  return (
    !extra &&
    /^[a-f0-9]{32}$/.test(nonce ?? '') &&
    /^[a-f0-9]{64}$/.test(sig ?? '') &&
    Number.isSafeInteger(time) &&
    time > Date.now() / 1000 &&
    time <= Date.now() / 1000 + ttl &&
    equal(sig, signature(`${expiry}.${nonce}`))
  );
}
export function issue(cookies: Cookies, secure: boolean) {
  const value = `${Math.floor(Date.now() / 1000) + ttl}.${randomBytes(16).toString('hex')}`;
  cookies.set(cookie, `${value}.${signature(value)}`, {
    path: '/',
    secure,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: ttl
  });
}
export function logout(cookies: Cookies) {
  cookies.delete(cookie, { path: '/' });
}
export function loginAllowed(ip: string) {
  const now = Date.now();
  for (const [key, entry] of failures)
    if (entry.until <= now) failures.delete(key);
  const entry = failures.get(ip) ?? { count: 0, until: now + 15 * 60_000 };
  if (entry.count >= 5) return false;
  entry.count++;
  if (failures.size < 10000 || failures.has(ip)) failures.set(ip, entry);
  return true;
}
export async function checkPassword(password: unknown) {
  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    password.length > 256
  )
    return false;
  const [salt, hash] = (cloudConfig().passwordHash ?? '').split(':');
  if (!/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(hash ?? ''))
    return false;
  const candidate = (await derive(password, salt, 64)) as Buffer;
  return equal(candidate.toString('hex'), hash);
}
export function isCron(request: Request) {
  const secret = cloudConfig().cronSecret;
  return (
    !!secret &&
    equal(request.headers.get('authorization') ?? '', `Bearer ${secret}`)
  );
}

import { FINASSIST_API_URL } from '$app/env/private';
export function backendURL() {
  if (!FINASSIST_API_URL) return null;
  const url = new URL(FINASSIST_API_URL);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/'
  )
    throw new Error('FINASSIST_API_URL deve conter apenas a origem da API.');
  return url;
}

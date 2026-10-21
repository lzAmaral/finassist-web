import {
  PLUGGY_CLIENT_ID,
  PLUGGY_CLIENT_SECRET,
  PLUGGY_ITEM_IDS,
  FINASSIST_PASSWORD_HASH,
  FINASSIST_SESSION_KEY,
  FINASSIST_DATA_KEY,
  BLOB_READ_WRITE_TOKEN,
  CRON_SECRET
} from '$app/env/private';

export const cloudConfig = () => ({
  clientId: PLUGGY_CLIENT_ID,
  clientSecret: PLUGGY_CLIENT_SECRET,
  itemIds: (PLUGGY_ITEM_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  passwordHash: FINASSIST_PASSWORD_HASH,
  sessionKey: FINASSIST_SESSION_KEY,
  dataKey: FINASSIST_DATA_KEY,
  blobToken: BLOB_READ_WRITE_TOKEN,
  cronSecret: CRON_SECRET
});
export function cloudConfigured() {
  const c = cloudConfig();
  return !!(
    c.clientId &&
    c.clientSecret &&
    c.itemIds.length &&
    c.passwordHash &&
    c.sessionKey &&
    c.dataKey &&
    c.blobToken
  );
}

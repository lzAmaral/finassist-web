import { defineEnvVars } from '@sveltejs/kit/env';

const secret = {
  public: false as const,
  static: false as const,
  schema: (value: string | undefined) => value || undefined
};
export const variables = defineEnvVars({
  FINASSIST_API_URL: {
    public: false,
    static: false,
    schema: (value: string | undefined) => value || undefined,
    description:
      'Origem privada do backend Go; ausente mantém o painel vazio, sem dados financeiros.'
  },
  PLUGGY_CLIENT_ID: secret,
  PLUGGY_CLIENT_SECRET: secret,
  PLUGGY_ITEM_IDS: secret,
  FINASSIST_PASSWORD_HASH: secret,
  FINASSIST_SESSION_KEY: secret,
  FINASSIST_DATA_KEY: secret,
  BLOB_READ_WRITE_TOKEN: secret,
  CRON_SECRET: secret
});

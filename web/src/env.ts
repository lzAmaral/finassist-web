import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
  FINASSIST_API_URL: {
    public: false,
    static: false,
    schema: (value: string | undefined) => value || undefined,
    description:
      'Origem privada do backend Go; ausente habilita apenas a demonstração.'
  }
});

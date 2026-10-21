import { backendURL } from '#lib/server/backend.js';
import { cloudConfigured } from '#lib/server/cloud-config.js';
export const load = () => ({
  configured: !!backendURL() || cloudConfigured(),
  cloud: !backendURL() && cloudConfigured()
});

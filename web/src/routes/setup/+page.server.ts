import { backendURL } from '#lib/server/backend.js';
export const load = () => ({ configured: !!backendURL() });

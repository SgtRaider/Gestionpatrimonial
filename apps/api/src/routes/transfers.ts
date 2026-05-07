import type { FastifyPluginAsync } from 'fastify';
import { detectInternalTransfers } from '../services/transfer-detector.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

export const transfersRoutes: FastifyPluginAsync = async (app) => {
  // Run the internal-transfer detector against the user's full untagged set.
  // Idempotent: re-running with no new transactions is a no-op.
  app.post('/transfers/detect', async () => {
    return detectInternalTransfers(DEFAULT_USER_ID);
  });
};

import type { FastifyPluginAsync } from 'fastify';
import {
  computeNetWorth,
  listNetWorthSnapshots,
  materializeNetWorthSnapshot,
} from '../services/net-worth.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

export const netWorthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/net-worth', async () => computeNetWorth(DEFAULT_USER_ID));
  app.get('/net-worth/snapshots', async () => listNetWorthSnapshots(DEFAULT_USER_ID));
  app.post('/net-worth/snapshots', async () => materializeNetWorthSnapshot(DEFAULT_USER_ID));
};

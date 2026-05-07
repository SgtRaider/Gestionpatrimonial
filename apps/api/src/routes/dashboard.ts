import type { FastifyPluginAsync } from 'fastify';
import { buildDashboard } from '../services/dashboard.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dashboard', async () => buildDashboard(DEFAULT_USER_ID));
};

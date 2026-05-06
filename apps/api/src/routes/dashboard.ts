import type { FastifyPluginAsync } from 'fastify';
import { dashboardFixture } from '../fixtures/dashboard.js';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dashboard', async () => dashboardFixture);
};

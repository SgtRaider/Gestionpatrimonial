import type { FastifyPluginAsync } from 'fastify';
import { getCategorizationQueue } from '../services/categorization-queue.js';

const DEFAULT_USER_ID = '01951b00-0000-7000-8000-000000000001';

export const categorizationQueueRoutes: FastifyPluginAsync = async (app) => {
  app.get('/categorization-queue', async () => getCategorizationQueue(DEFAULT_USER_ID));
};

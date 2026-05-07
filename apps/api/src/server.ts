import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';
import { config } from './config.js';
import { categorizationRulesRoutes } from './routes/categorization-rules.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { healthRoutes } from './routes/health.js';
import { importsRoutes } from './routes/imports.js';
import { loansRoutes } from './routes/loans.js';
import { recurringRoutes } from './routes/recurring.js';
import { transactionsRoutes } from './routes/transactions.js';
import { transfersRoutes } from './routes/transfers.js';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  await app.register(healthRoutes);
  await app.register(dashboardRoutes, { prefix: '/api' });
  await app.register(transactionsRoutes, { prefix: '/api' });
  await app.register(categorizationRulesRoutes, { prefix: '/api' });
  await app.register(importsRoutes, { prefix: '/api' });
  await app.register(loansRoutes, { prefix: '/api' });
  await app.register(recurringRoutes, { prefix: '/api' });
  await app.register(transfersRoutes, { prefix: '/api' });

  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port: config.API_PORT, host: config.API_HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

import express from 'express';
import pinoHttp from 'pino-http';
import { sql } from 'drizzle-orm';
import { applySecurity } from './middleware/security';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './lib/logger';
import { db } from './db';

export function createApp() {
  const app = express();

  applySecurity(app);
  app.use(pinoHttp({ logger, autoLogging: false }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/health/db', (_req, res) => {
    try {
      db.run(sql`SELECT 1`);
      res.status(200).json({ status: 'ok', db: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', db: 'unavailable' });
    }
  });

  app.use('/api/v1', (_req, res) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Route not found',
      code: 404
    });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Route not found',
      code: 404
    });
  });

  app.use(errorHandler);

  return app;
}

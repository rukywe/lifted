import express from 'express';
import pinoHttp from 'pino-http';
import { applySecurity } from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './lib/logger.js';

export function createApp() {
  const app = express();

  applySecurity(app);
  app.use(pinoHttp({ logger, autoLogging: false }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

import './db';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { startExpireHoldsCron } from './jobs/expireHolds';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info('Health: GET /health');
  logger.info('Health: GET /health/db');
  logger.info('API: GET  /api/v1/availability');
  logger.info('API: POST /api/v1/bookings');
  logger.info('API: POST /api/v1/bookings/:id/confirm');
  logger.info('API: GET  /api/v1/bookings');

  startExpireHoldsCron();
});

function gracefulShutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

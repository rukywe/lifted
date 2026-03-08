import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { NotFoundError, BusinessRuleError, ConflictError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

interface SqliteError extends Error {
  code?: string;
}

interface ErrorResponse {
  error: string;
  message: string;
  code: number;
  details?: unknown;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error({ err }, err.message);

  if (err instanceof NotFoundError) {
    const response: ErrorResponse = {
      error: err.code,
      message: err.message,
      code: 404,
    };
    res.status(404).json(response);
    return;
  }

  if (err instanceof BusinessRuleError) {
    const response: ErrorResponse = {
      error: err.code,
      message: err.message,
      code: 400,
    };
    res.status(400).json(response);
    return;
  }

  if (err instanceof ConflictError) {
    const response: ErrorResponse = {
      error: err.code,
      message: err.message,
      code: 409,
    };
    res.status(409).json(response);
    return;
  }

  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      code: 422,
      details: err.errors,
    };
    res.status(422).json(response);
    return;
  }

  const sqliteErr = err as SqliteError;
  if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    const response: ErrorResponse = {
      error: 'DUPLICATE_REQUEST',
      message: 'A conflicting record already exists',
      code: 409,
    };
    res.status(409).json(response);
    return;
  }

  if (sqliteErr.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    const response: ErrorResponse = {
      error: 'INVALID_REFERENCE',
      message: 'Referenced record does not exist',
      code: 400,
    };
    res.status(400).json(response);
    return;
  }

  const response: ErrorResponse = {
    error: 'INTERNAL_ERROR',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    code: 500,
  };
  res.status(500).json(response);
}

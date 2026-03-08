import helmet from 'helmet';
import cors from 'cors';
import type { Express } from 'express';

export function applySecurity(app: Express): void {
  app.use(helmet());
  app.use(cors());
}

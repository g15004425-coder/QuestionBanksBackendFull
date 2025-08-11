import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { banksRouter } from './routes/banks.js';
import { meRouter } from './routes/me.js';
import { usersRouter } from './routes/users.js';
import { legalRouter } from './routes/legal.js';
import { healthRouter } from './routes/health.js';
import { paymentsRouter } from './routes/payments.js';

export function buildApp() {
  const app = express();

  app.set('trust proxy', true); // important for correct req.ip behind proxies/CDN

  app.use(helmet());
  app.use(hpp());
  app.use(compression());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan('dev'));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/banks', banksRouter);
  app.use('/api', meRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/legal', legalRouter);
  app.use('/api/health', healthRouter);

    app.use('/api/payments', paymentsRouter);

  // 404
  app.use((req, res) => res.status(404).json({ message: 'Not found' }));

  // error handler
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || 'Server error' });
  });

  return app;
}

import { Router } from 'express';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    region: process.env.VERCEL_REGION || null,
    hasMongoUri: Boolean(env.mongoUri),
    corsOrigin: env.corsOrigin || null,
    frontendUrl: env.frontendUrl || null,
  });
});

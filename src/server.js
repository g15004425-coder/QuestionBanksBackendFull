// src/server.js
import http from 'http';
import { buildApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  await connectDB(env.mongoUri);
  const app = buildApp();
  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`[DEV] HTTP server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[DEV] Boot error:', err);
  process.exit(1);
});

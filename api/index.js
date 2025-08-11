// api/index.js
import { buildApp } from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';

// ابنِ الـ app مرة واحدة
const app = buildApp();

export default async function handler(req, res) {
  try {
    // اتصال متكاش (اتأكد إنك حدّثت db.js اللي تحت)
    await connectDB(env.mongoUri);
    return app(req, res);
  } catch (err) {
    console.error('[Vercel] ERROR:', err && (err.stack || err));
    res.status(500).json({ message: 'Server error' });
  }
}

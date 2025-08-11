import { StatusCodes as S } from 'http-status-codes';
import { verifyAccess } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { Token } from '../models/Token.js';

export async function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(S.UNAUTHORIZED).json({ message: 'Missing token' });

    const decoded = verifyAccess(token);
    const rec = await Token.findOne({ userId: decoded.userId });
    if (!rec) return res.status(S.UNAUTHORIZED).json({ message: 'Session expired' });
    if (rec.accessJti !== decoded.jti) {
      return res.status(S.UNAUTHORIZED).json({ message: 'Token invalidated' });
    }
    if (env.bindIP && rec.ip && rec.ip !== req.ip) {
      return res.status(S.UNAUTHORIZED).json({ message: 'IP mismatch' });
    }

    req.user = { id: decoded.userId };
    next();
  } catch (e) {
    return res.status(S.UNAUTHORIZED).json({ message: 'Invalid token' });
  }
}

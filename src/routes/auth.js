import { Router } from 'express';
import { StatusCodes as S } from 'http-status-codes';
import { User } from '../models/User.js';
import { Token } from '../models/Token.js';
import { signAccess, signRefresh, verifyRefresh } from '../utils/jwt.js';
import { hash } from '../utils/password.js';
import { authLimiter, refreshLimiter } from '../config/rateLimit.js';
import { env } from '../config/env.js';
import bcrypt from 'bcryptjs';

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, agreeToTerms } = req.body;
  if (!agreeToTerms) {
    return res.status(S.BAD_REQUEST).json({ message: 'You must agree to the Terms of Service and Privacy Policy.' });
  }
  const exists = await User.findOne({ email });
  if (exists) return res.status(S.CONFLICT).json({ message: 'Email already registered' });
  const u = new User({ name, email, passwordHash: '' });
  await u.setPassword(password);
  await u.save();
  return res.status(S.CREATED).json({ message: 'Registered' });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password, rememberMe } = req.body;
  const u = await User.findOne({ email });
  if (!u || !(await u.comparePassword(password))) {
    return res.status(S.UNAUTHORIZED).json({ message: 'Invalid credentials' });
  }

  // Invalidate any previous sessions for this user
  await Token.deleteMany({ userId: u._id });

  // Create tokens
  const { token: accessToken, jti } = signAccess({ userId: u._id.toString() });
  const refreshToken = signRefresh({ userId: u._id.toString() });

  // Store refresh token hash & access jti
  const refreshHash = await hash(refreshToken);
  const expiresAt = new Date(Date.now() + parseTTL(env.refreshTTL));
  await Token.create({
    userId: u._id,
    accessJti: jti,
    refreshHash,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    expiresAt
  });

  setAuthCookies(res, refreshToken, rememberMe ? env.refreshTTLLong : env.refreshTTLShort);
  return res.json({ accessToken });
});

authRouter.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(S.UNAUTHORIZED).json({ message: 'Missing refresh token' });
    const decoded = verifyRefresh(token);
    const rec = await Token.findOne({ userId: decoded.userId });
    if (!rec) return res.status(S.UNAUTHORIZED).json({ message: 'Session expired' });

    // verify refresh token hash
    const ok = await bcrypt.compare(token, rec.refreshHash);
    if (!ok) return res.status(S.UNAUTHORIZED).json({ message: 'Invalid refresh token' });

    // rotate refresh + access (single session)
    const { token: newAccess, jti } = signAccess({ userId: decoded.userId });
    const newRefresh = signRefresh({ userId: decoded.userId });
    rec.accessJti = jti;
    rec.refreshHash = await hash(newRefresh);
    rec.ip = req.ip;
    rec.userAgent = req.headers['user-agent'];
    rec.expiresAt = new Date(Date.now() + parseTTL(process.env.REFRESH_TOKEN_TTL || '30d'));
    await rec.save();

    setAuthCookies(res, newRefresh);
    return res.json({ accessToken: newAccess });
  } catch (e) {
    return res.status(S.UNAUTHORIZED).json({ message: 'Invalid refresh token' });
  }
});

authRouter.post('/logout', async (req, res) => {
  const { userId } = req.body; // or from access token if provided
  if (userId) await Token.deleteMany({ userId });
  // clear cookie
  res.clearCookie('refreshToken', cookieOptions());
  return res.json({ message: 'Logged out' });
});

function parseTTL(ttl) {
  // Very small helper for d/h/m suffix
  const m = /^([0-9]+)([smhd])$/.exec(ttl);
  const n = parseInt(m[1], 10);
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
  return n * mult;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE !== 'false',
    path: '/api/auth'
  };
}

function setAuthCookies(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, cookieOptions());
}

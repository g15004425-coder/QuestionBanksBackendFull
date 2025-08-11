import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';

export function signAccess(payload) {
  const jti = uuidv4();
  const token = jwt.sign({ ...payload, jti }, env.jwtAccessSecret, { expiresIn: env.accessTTL });
  return { token, jti };
}

export function signRefresh(payload, ttlOpt) {
  const jti = uuidv4(); // not used, but good practice
  const token = jwt.sign({ ...payload, jti }, env.jwtRefreshSecret, { expiresIn: ttlOpt || env.refreshTTL });
  return token;
}

export function verifyAccess(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

export function verifyRefresh(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

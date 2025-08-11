import { StatusCodes as S } from 'http-status-codes';
import { Purchase } from '../models/Purchase.js';

export async function requirePurchase(req, res, next) {
  const userId = req.user.id;
  const bankId = req.params.bankId;
  const p = await Purchase.findOne({ userId, bankId, isActive: true });
  if (!p) return res.status(S.FORBIDDEN).json({ message: 'Please purchase access' });
  next();
}

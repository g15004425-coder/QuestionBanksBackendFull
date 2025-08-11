import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { Purchase } from '../models/Purchase.js';

export const meRouter = Router();

meRouter.get('/me', auth, async (req, res) => {
  res.json({ userId: req.user.id });
});

meRouter.get('/me/purchases', auth, async (req, res) => {
  const list = await Purchase.find({ userId: req.user.id, isActive: true });
  res.json(list);
});

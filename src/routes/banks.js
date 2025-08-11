import { Router } from 'express';
import { QuestionBank } from '../models/QuestionBank.js';
import { Question } from '../models/Question.js';
import { Purchase } from '../models/Purchase.js';
import { auth } from '../middleware/auth.js';
import { requirePurchase } from '../middleware/requirePurchase.js';
import { StatusCodes as S } from 'http-status-codes';

export const banksRouter = Router();

/**
 * GET /banks
 * Public listing (no questions) with search & pagination
 * Query params: page=1, limit=12, q=""
 */
banksRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 100);
    const q = (req.query.q || '').trim();

    const filter = {};
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      QuestionBank.find(filter, { title: 1, description: 1, price: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      QuestionBank.countDocuments(filter),
    ]);

    res.json({
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /banks/:bankId/purchase
 * Simulated purchase (replace with real payment webhook in production)
 * Requires auth
 */
banksRouter.post('/:bankId/purchase', auth, async (req, res, next) => {
  try {
    const { bankId } = req.params;
    const userId = req.user.id;

    const exists = await Purchase.findOne({ userId, bankId, isActive: true });
    if (exists) {
      return res.status(S.OK).json({ message: 'Already purchased' });
    }

    await Purchase.create({ userId, bankId, isActive: true });
    res.status(S.CREATED).json({ message: 'Purchased' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /banks/:bankId/questions
 * Get questions (answers hidden), requires auth + active purchase
 */
banksRouter.get('/:bankId/questions', auth, requirePurchase, async (req, res, next) => {
  try {
    const { bankId } = req.params;
    const qs = await Question.find({ bankId }, { answerIndex: 0 }); // hide answers by default
    res.json(qs);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /banks/:bankId/answers
 * Optionally fetch answers separately, requires auth + active purchase
 */
banksRouter.get('/:bankId/answers', auth, requirePurchase, async (req, res, next) => {
  try {
    const { bankId } = req.params;
    const qs = await Question.find({ bankId }, { _id: 1, answerIndex: 1 });
    res.json(qs);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /banks/:bankId
 * Bank details (public)
 */
banksRouter.get('/:bankId', async (req, res, next) => {
  try {
    const { bankId } = req.params;
    const bank = await QuestionBank.findById(bankId);
    if (!bank) {
      return res.status(S.NOT_FOUND).json({ message: 'Bank not found' });
    }
    res.json(bank);
  } catch (err) {
    next(err);
  }
});

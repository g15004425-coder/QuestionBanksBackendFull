import { Router } from 'express';
import { User } from '../models/User.js';
import { auth } from '../middleware/auth.js';

export const usersRouter = Router();

// جلب جميع المستخدمين (مع استبعاد الباسورد)
usersRouter.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({}, { passwordHash: 0 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

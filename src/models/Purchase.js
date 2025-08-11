import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', index: true },
  bankId: { type: mongoose.Types.ObjectId, ref: 'QuestionBank', index: true },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date }
}, { timestamps: true });

export const Purchase = mongoose.model('Purchase', purchaseSchema);

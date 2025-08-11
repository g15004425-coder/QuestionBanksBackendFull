import mongoose from 'mongoose';

const bankSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  price: { type: Number, default: 0 }
}, { timestamps: true });

export const QuestionBank = mongoose.model('QuestionBank', bankSchema);

import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  bankId: { type: mongoose.Types.ObjectId, ref: 'QuestionBank', index: true },
  title: String,
  body: String,
  options: [String],
  answerIndex: Number
}, { timestamps: true });

export const Question = mongoose.model('Question', questionSchema);

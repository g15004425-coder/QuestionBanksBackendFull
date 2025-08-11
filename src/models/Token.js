import mongoose from 'mongoose';

/**
 * Stores the SINGLE active session for a user.
 * We keep access token id (jti) and a hashed refresh token.
 */
const tokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', index: true, unique: true },
  accessJti: { type: String, required: true },
  refreshHash: { type: String, required: true },
  ip: { type: String },
  userAgent: { type: String },
  expiresAt: { type: Date } // mirrors refresh token expiry
}, { timestamps: true });

tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Token = mongoose.model('Token', tokenSchema);

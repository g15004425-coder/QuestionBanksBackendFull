// src/config/db.js
import mongoose from 'mongoose';

let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

export async function connectDB(uri) {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    if (!uri) throw new Error('MONGO_URI is not set');
    mongoose.set('strictQuery', true);
    cached.promise = mongoose
      .connect(uri, { autoIndex: true })
      .then((m) => m)
      .catch((e) => { cached.promise = null; throw e; });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

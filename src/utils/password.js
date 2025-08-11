import bcrypt from 'bcryptjs';

export async function hash(value) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(value, salt);
}

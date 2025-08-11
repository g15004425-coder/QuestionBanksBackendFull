import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '8443', 10),
  mongoUri: process.env.MONGO_URI,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTTL: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTTL: process.env.REFRESH_TOKEN_TTL || '30d',
  refreshTTLShort: process.env.REFRESH_TOKEN_TTL_SHORT || '1d',
  refreshTTLLong: process.env.REFRESH_TOKEN_TTL_LONG || (process.env.REFRESH_TOKEN_TTL || '30d'),

  bindIP: (process.env.BIND_IP || 'true').toLowerCase() === 'true',
  httpsKeyPath: process.env.HTTPS_KEY_PATH,
  httpsCertPath: process.env.HTTPS_CERT_PATH,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  cookieSecure: (process.env.COOKIE_SECURE || 'true').toLowerCase() === 'true',

  // Payments (Checkout.com Hosted Payments)
  checkoutSecretKey: process.env.CHECKOUT_SECRET_KEY,
  processingChannelId: process.env.PROCESSING_CHANNEL_ID,
  frontendUrl: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '*',

  // Email (SMTP)
  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM || 'no-reply@questionbanks.app',

};

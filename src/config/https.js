import fs from 'fs';

export function loadHTTPSCreds(keyPath, certPath) {
  if (!keyPath || !certPath) return null;
  try {
    const key = fs.readFileSync(keyPath);
    const cert = fs.readFileSync(certPath);
    return { key, cert };
  } catch (e) {
    console.warn('[HTTPS] Failed to read certificates, falling back to HTTP:', e.message);
    return null;
  }
}

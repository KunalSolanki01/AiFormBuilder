import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

const handler = (message) => (_req, res) =>
  res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message } });

const userOrIp = (req) => req.user?.id ?? ipKeyGenerator(req.ip);

const make = (windowMs, limit, message, keyGenerator) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: handler(message),
    ...(keyGenerator && { keyGenerator }),
  });

/** Global safety net for the whole API. */
export const apiLimiter = make(15 * 60 * 1000, 600, 'Too many requests. Please slow down and try again shortly.');

/** Login / register brute-force protection. */
export const authLimiter = make(15 * 60 * 1000, 20, 'Too many attempts. Please wait a few minutes and try again.');

/** Groq calls are the expensive path — limit per user. */
export const aiLimiter = make(
  60 * 60 * 1000,
  30,
  "You've reached the hourly AI limit. Please try again later.",
  userOrIp,
);

/** Public file uploads — per IP. Files are small (1 MB) but each one costs storage. */
export const uploadLimiter = make(10 * 60 * 1000, 20, 'Too many uploads. Please wait a few minutes and try again.');

/** Google email verification — per IP. */
export const verifyLimiter = make(10 * 60 * 1000, 30, 'Too many verification attempts. Please wait a few minutes.');

/** Public form submissions — per IP. */
export const submitLimiter = make(60 * 1000, 20, 'Too many submissions. Please wait a minute and try again.');

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin / server-to-server requests have no Origin header.
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        if (
          env.CLIENT_ORIGINS.includes(cleanOrigin) ||
          (cleanOrigin.endsWith('.vercel.app') && cleanOrigin.includes('ai-form-builder-kunal'))
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  // Restore original request path when running behind Vercel rewrites
  app.use((req, _res, next) => {
    if (req.query?.__path !== undefined) {
      const targetPath = '/' + String(req.query.__path).replace(/^\/+/, '');
      const urlObj = new URL(req.url, 'http://localhost');
      urlObj.searchParams.delete('__path');
      delete req.query.__path;
      req.url = targetPath + (urlObj.search || '');
    } else if (req.headers['x-now-route-matches']) {
      try {
        const matches = new URLSearchParams(req.headers['x-now-route-matches']);
        const matched = matches.get('1') || matches.get('path');
        if (matched) {
          req.url = '/' + decodeURIComponent(matched).replace(/^\/+/, '');
        }
      } catch {
        /* ignore parsing error */
      }
    }
    next();
  });

  app.use(express.json({ limit: '200kb' }));

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        message: 'AI Form Builder API is running',
        status: 'ok',
        version: '1.0.0',
      },
    });
  });

  app.use('/api', apiLimiter, apiRouter);
  app.use(apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

let appInstance;

export default function handler(req, res) {
  if (!appInstance) {
    appInstance = createApp();
  }
  return appInstance(req, res);
}


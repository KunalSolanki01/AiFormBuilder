import { FILE_UPLOAD } from '@afb/shared';
import express, { Router } from 'express';
import * as ai from '../controllers/aiController.js';
import * as analytics from '../controllers/analyticsController.js';
import * as auth from '../controllers/authController.js';
import * as files from '../controllers/fileController.js';
import * as forms from '../controllers/formController.js';
import * as responses from '../controllers/responseController.js';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter, authLimiter, submitLimiter, uploadLimiter, verifyLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import * as v from '../validators/index.js';

// ── /api/auth ──────────────────────────────────────────
const authRouter = Router();
authRouter.post('/register', authLimiter, validate({ body: v.registerBody }), auth.register);
authRouter.post('/login', authLimiter, validate({ body: v.loginBody }), auth.login);
authRouter.post('/refresh', authLimiter, validate({ body: v.refreshBody }), auth.refresh);
authRouter.post('/logout', requireAuth, auth.logout);
authRouter.get('/me', requireAuth, auth.me);

// ── /api/forms (owner only) ────────────────────────────
const formsRouter = Router();
formsRouter.use(requireAuth);
formsRouter.get('/', forms.list);
formsRouter.post('/', validate({ body: v.createFormBody }), forms.create);
formsRouter.get('/:id', validate({ params: v.idParams }), forms.get);
formsRouter.put('/:id', validate({ params: v.idParams, body: v.updateFormBody }), forms.update);
formsRouter.delete('/:id', validate({ params: v.idParams }), forms.remove);
formsRouter.post('/:id/publish', validate({ params: v.idParams }), forms.publish);
formsRouter.post('/:id/close', validate({ params: v.idParams }), forms.close);
formsRouter.get('/:id/responses', validate({ params: v.idParams, query: v.listResponsesQuery }), responses.list);
formsRouter.get('/:id/responses/:responseId', validate({ params: v.responseParams }), responses.get);
formsRouter.get('/:id/files', validate({ params: v.idParams, query: v.downloadQuery }), files.download);
formsRouter.get('/:id/analytics', validate({ params: v.idParams }), analytics.get);

// ── /api/ai ────────────────────────────────────────────
const aiRouter = Router();
aiRouter.use(requireAuth, aiLimiter);
aiRouter.post('/generate-form', validate({ body: v.generateFormBody }), ai.generateForm);
aiRouter.post('/analyze-responses', validate({ body: v.analyzeResponsesBody }), ai.analyzeResponses);

// ── /api/public (no auth) ──────────────────────────────
const publicRouter = Router();
publicRouter.get('/forms/:slug', validate({ params: v.slugParams }), responses.getPublicForm);
publicRouter.post(
  '/forms/:slug/verify-email',
  verifyLimiter,
  validate({ params: v.slugParams, body: v.verifyEmailBody }),
  responses.verifyEmail,
);
publicRouter.post(
  '/forms/:slug/uploads',
  uploadLimiter,
  express.raw({ type: 'application/octet-stream', limit: FILE_UPLOAD.MAX_BYTES }),
  validate({ params: v.slugParams, query: v.uploadQuery }),
  files.upload,
);
publicRouter.post(
  '/forms/:slug/responses',
  submitLimiter,
  validate({ params: v.slugParams, body: v.submitResponseBody }),
  responses.submit,
);

export const apiRouter = Router();
apiRouter.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
apiRouter.use('/auth', authRouter);
apiRouter.use('/forms', formsRouter);
apiRouter.use('/ai', aiRouter);
apiRouter.use('/public', publicRouter);

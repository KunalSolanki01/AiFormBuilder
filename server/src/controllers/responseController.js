import * as emailVerification from '../services/emailVerificationService.js';
import * as formService from '../services/formService.js';
import * as responseService from '../services/responseService.js';

// ── Public ─────────────────────────────────────────────

export async function getPublicForm(req, res) {
  const row = await formService.getPublicFormRow(req.validated.params.slug);
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: formService.toPublicFormDto(row) });
}

export async function verifyEmail(req, res) {
  const { field, credential } = req.validated.body;
  const data = await emailVerification.verifyEmailForForm(req.validated.params.slug, field, credential);
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data });
}

export async function submit(req, res) {
  const result = await responseService.submitResponse(req.validated.params.slug, req.validated.body, {
    userAgent: req.get('user-agent'),
  });
  res.status(result.duplicate ? 200 : 201).json({ success: true, data: result });
}

// ── Owner ──────────────────────────────────────────────

export async function list(req, res) {
  const data = await responseService.listResponses(req.user.id, req.validated.params.id, req.validated.query);
  res.json({ success: true, data });
}

export async function get(req, res) {
  const { id, responseId } = req.validated.params;
  res.json({ success: true, data: await responseService.getResponse(req.user.id, id, responseId) });
}

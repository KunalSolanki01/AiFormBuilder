import { analyzeFormResponses } from '../services/analyticsService.js';
import { getGroqService } from '../services/groqService.js';

export async function generateForm(req, res) {
  const groq = await getGroqService();
  const { form, warnings } = await groq.generateForm(req.validated.body.prompt);
  res.json({ success: true, data: form, warnings });
}

export async function analyzeResponses(req, res) {
  const groq = await getGroqService();
  const analysis = await analyzeFormResponses(req.user.id, req.validated.body.formId, groq);
  res.status(201).json({ success: true, data: analysis });
}

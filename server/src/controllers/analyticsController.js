import { getAnalytics } from '../services/analyticsService.js';

export async function get(req, res) {
  res.json({ success: true, data: await getAnalytics(req.user.id, req.validated.params.id) });
}

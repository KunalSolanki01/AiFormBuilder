import * as fileService from '../services/fileService.js';
import { badRequest } from '../utils/AppError.js';

/** POST /api/public/forms/:slug/uploads?field=<key>&filename=<name>  — raw bytes in the body. */
export async function upload(req, res) {
  if (!Buffer.isBuffer(req.body)) {
    throw badRequest('Send the file as the request body (Content-Type: application/octet-stream).');
  }
  const { slug } = req.validated.params;
  const { field, filename } = req.validated.query;
  const file = await fileService.uploadFile(slug, field, filename, req.body);
  res.status(201).json({ success: true, data: file });
}

/** GET /api/forms/:id/files?path=...&name=...  — owner only, returns a short-lived URL. */
export async function download(req, res) {
  const { id } = req.validated.params;
  const { path, name } = req.validated.query;
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: await fileService.getDownloadUrl(req.user.id, id, path, name) });
}

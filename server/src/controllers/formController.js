import * as fileService from '../services/fileService.js';
import * as formService from '../services/formService.js';

export async function list(req, res) {
  res.json({ success: true, data: await formService.listForms(req.user.id) });
}

export async function create(req, res) {
  const form = await formService.createForm(req.user.id, req.validated.body);
  res.status(201).json({ success: true, data: form });
}

export async function get(req, res) {
  res.json({ success: true, data: await formService.getOwnedForm(req.user.id, req.validated.params.id) });
}

export async function update(req, res) {
  const form = await formService.updateForm(req.user.id, req.validated.params.id, req.validated.body);
  res.json({ success: true, data: form });
}

export async function remove(req, res) {
  await formService.deleteForm(req.user.id, req.validated.params.id);
  // Storage isn't covered by the DB cascade; failures are logged, not surfaced.
  await fileService.removeFormFiles(req.validated.params.id);
  res.json({ success: true, data: null });
}

export async function publish(req, res) {
  res.json({ success: true, data: await formService.publishForm(req.user.id, req.validated.params.id) });
}

export async function close(req, res) {
  res.json({ success: true, data: await formService.closeForm(req.user.id, req.validated.params.id) });
}

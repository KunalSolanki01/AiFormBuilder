import { supabaseAdmin } from '../config/supabase.js';
import { AppError, databaseError } from '../utils/AppError.js';

export const ALREADY_RESPONDED_MESSAGE = 'This email has already responded to this form.';

/** 409 shown on the email question. */
export const alreadyRespondedError = (fieldKey) =>
  new AppError(409, 'ALREADY_RESPONDED', ALREADY_RESPONDED_MESSAGE, [{ path: fieldKey, message: ALREADY_RESPONDED_MESSAGE }]);

/**
 * Has this verified email already submitted? Used for the early check right after Google sign-in
 * (so people don't fill in a whole form first). The authoritative, race-free check is inside
 * the submit_response database function.
 */
export async function emailAlreadyResponded(formId, fieldId, email) {
  const { data, error } = await supabaseAdmin.rpc('email_has_responded', {
    p_form_id: formId,
    p_field_id: fieldId,
    p_email: email,
  });
  if (error) throw databaseError(error, 'email_has_responded');
  return data === true;
}

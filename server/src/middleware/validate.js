import { formatZodError } from '@afb/shared';
import { validationError } from '../utils/AppError.js';

/**
 * Validates request parts with Zod schemas and stores the parsed output on `req.validated`.
 * (Express 5 makes req.query read-only, so parsed values are never written back.)
 */
export const validate = (schemas) => (req, _res, next) => {
  req.validated = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = formatZodError(result.error);
      throw validationError(details[0]?.message ?? 'Invalid request.', details);
    }
    req.validated[part] = result.data;
  }
  next();
};

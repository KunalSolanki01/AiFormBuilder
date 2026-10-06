-- File uploads: new 'file' field type + a private bucket for respondents' files.
-- Allowed: pdf, doc, docx, jpg, jpeg, png — max 1 MB (enforced here as well as in the API).

ALTER TABLE public.form_fields DROP CONSTRAINT IF EXISTS form_fields_type_check;
ALTER TABLE public.form_fields ADD CONSTRAINT form_fields_type_check CHECK (type IN (
  'text', 'textarea', 'email', 'number', 'phone', 'select',
  'radio', 'checkbox', 'rating', 'date', 'boolean', 'file'));

-- Private bucket. No storage policies are created on purpose: anonymous and
-- authenticated browser clients get no direct access; only the API (service
-- role) reads/writes, and owners download through short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-uploads', 'form-uploads', FALSE, 1048576,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

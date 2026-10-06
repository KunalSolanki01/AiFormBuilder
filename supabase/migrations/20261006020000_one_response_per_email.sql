-- One response per verified email.
-- A verified email question can be marked "unique". The API then passes the (lower-cased) verified address
-- as a dedupe key. Submissions are serialised per form by the row lock in submit_response, so two requests
-- can never both pass the check; the partial unique index is a second line of defence.

ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS responses_form_dedupe_key_unique
  ON public.responses (form_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Has this verified email already responded to the form?
-- Counts responses saved with a dedupe key AND earlier Google-verified responses (made before the
-- "one per email" setting was switched on) whose email answer matches.
CREATE OR REPLACE FUNCTION public.email_has_responded(p_form_id UUID, p_field_id UUID, p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.responses r
    WHERE r.form_id = p_form_id AND r.dedupe_key = lower(p_email)
  ) OR EXISTS (
    SELECT 1
    FROM public.responses r
    JOIN public.response_answers a ON a.response_id = r.id
    WHERE r.form_id = p_form_id
      AND a.field_id = p_field_id
      AND r.metadata ? 'verified_emails'
      AND lower(a.value #>> '{}') = lower(p_email)
  );
$$;

-- Replace submit_response (new optional parameters). The old 4-argument version is dropped so a call
-- with named arguments can never be ambiguous.
DROP FUNCTION IF EXISTS public.submit_response(UUID, JSONB, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.submit_response(
  p_form_id UUID,
  p_answers JSONB,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_submission_id UUID DEFAULT NULL,
  p_dedupe_key TEXT DEFAULT NULL,
  p_dedupe_field_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_form public.forms%ROWTYPE;
  v_response_id UUID;
BEGIN
  SELECT * INTO v_form FROM public.forms WHERE id = p_form_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORM_NOT_FOUND';
  END IF;

  IF p_submission_id IS NOT NULL THEN
    SELECT id INTO v_response_id FROM public.responses
    WHERE submission_id = p_submission_id AND form_id = p_form_id;
    IF FOUND THEN
      RETURN jsonb_build_object('response_id', v_response_id, 'duplicate', TRUE,
                                'response_count', v_form.response_count);
    END IF;
  END IF;

  IF v_form.status <> 'published' THEN
    RAISE EXCEPTION 'FORM_CLOSED';
  END IF;

  IF v_form.response_limit IS NOT NULL AND v_form.response_count >= v_form.response_limit THEN
    RAISE EXCEPTION 'LIMIT_REACHED';
  END IF;

  IF p_dedupe_key IS NOT NULL
     AND public.email_has_responded(p_form_id, p_dedupe_field_id, p_dedupe_key) THEN
    RAISE EXCEPTION 'ALREADY_RESPONDED';
  END IF;

  INSERT INTO public.responses (form_id, metadata, submission_id, dedupe_key)
  VALUES (p_form_id, COALESCE(p_metadata, '{}'::jsonb), p_submission_id, lower(p_dedupe_key))
  RETURNING id INTO v_response_id;

  INSERT INTO public.response_answers (response_id, field_id, value)
  SELECT v_response_id, ff.id, a.value
  FROM jsonb_each(COALESCE(p_answers, '{}'::jsonb)) a
  JOIN public.form_fields ff ON ff.id::text = a.key AND ff.form_id = p_form_id;

  UPDATE public.forms SET response_count = response_count + 1 WHERE id = p_form_id;

  RETURN jsonb_build_object('response_id', v_response_id, 'duplicate', FALSE,
                            'response_count', v_form.response_count + 1);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_response(UUID, JSONB, JSONB, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_has_responded(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_response(UUID, JSONB, JSONB, UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_has_responded(UUID, UUID, TEXT) TO service_role;

-- Make the API see the new function signature straight away.
NOTIFY pgrst, 'reload schema';

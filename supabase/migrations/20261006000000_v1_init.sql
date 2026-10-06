-- AI Form Builder V1 — initial schema
-- Tables follow PRD §15 with a few integrity additions (checks, idempotency key,
-- recommendations column, unique field keys) and the RPCs the API relies on.

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────

-- Bumps updated_at, ignoring changes that only touch response_count
-- (so receiving a response doesn't look like an edit).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (to_jsonb(NEW) - 'response_count' - 'updated_at') IS DISTINCT FROM
     (to_jsonb(OLD) - 'response_count' - 'updated_at') THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create a profile automatically whenever a Supabase Auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NULLIF(NEW.raw_user_meta_data ->> 'name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- forms
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
    description TEXT,
    slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
    type TEXT DEFAULT 'survey',
    schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_limit INTEGER CHECK (response_limit IS NULL OR response_limit > 0),
    response_count INTEGER NOT NULL DEFAULT 0 CHECK (response_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX forms_user_id_updated_idx ON public.forms (user_id, updated_at DESC);

CREATE TRIGGER forms_updated_at
  BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- form_fields (normalized mirror of forms.schema.fields; ids are stable
-- across edits so response_answers keep pointing at the right field)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
      'text', 'textarea', 'email', 'number', 'phone', 'select',
      'radio', 'checkbox', 'rating', 'date', 'boolean')),
    label TEXT NOT NULL,
    description TEXT,
    required BOOLEAN DEFAULT FALSE,
    position INTEGER NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT form_fields_form_key_unique UNIQUE (form_id, field_key) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX form_fields_form_position_idx ON public.form_fields (form_id, position);

-- ─────────────────────────────────────────────────────────────
-- responses
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Client-generated idempotency key: retries of the same submission are not double counted.
    submission_id UUID UNIQUE
);

CREATE INDEX responses_form_submitted_idx ON public.responses (form_id, submitted_at DESC);

-- ─────────────────────────────────────────────────────────────
-- response_answers
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.response_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES public.form_fields(id) ON DELETE CASCADE,
    value JSONB,
    CONSTRAINT response_answers_unique UNIQUE (response_id, field_id)
);

CREATE INDEX response_answers_field_idx ON public.response_answers (field_id);

-- ─────────────────────────────────────────────────────────────
-- ai_analyses
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.ai_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL,
    summary TEXT,
    insights JSONB DEFAULT '[]'::jsonb,
    sentiment JSONB,
    recommendations JSONB DEFAULT '[]'::jsonb,
    response_count INTEGER,
    model TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ai_analyses_form_generated_idx ON public.ai_analyses (form_id, generated_at DESC);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- The Express API uses the service role and enforces ownership itself;
-- RLS is defence in depth for any direct client/PostgREST access.
-- Anonymous users get no direct table access: public forms are served by the API.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "forms_owner_all" ON public.forms
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "form_fields_owner_all" ON public.form_fields
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.user_id = (SELECT auth.uid())));

CREATE POLICY "responses_owner_select" ON public.responses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.user_id = (SELECT auth.uid())));

CREATE POLICY "response_answers_owner_select" ON public.response_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.responses r JOIN public.forms f ON f.id = r.form_id
    WHERE r.id = response_id AND f.user_id = (SELECT auth.uid())));

CREATE POLICY "ai_analyses_owner_select" ON public.ai_analyses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.user_id = (SELECT auth.uid())));

-- ─────────────────────────────────────────────────────────────
-- RPC: sync_form_fields
-- Atomically mirrors forms.schema.fields into form_fields, keeping ids stable.
-- p_fields: [{ id, key, type, label, description, required, position, ...config }]
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_form_fields(p_form_id UUID, p_fields JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.form_fields ff
  WHERE ff.form_id = p_form_id
    AND ff.id NOT IN (SELECT (e ->> 'id')::uuid FROM jsonb_array_elements(p_fields) e);

  INSERT INTO public.form_fields (id, form_id, field_key, type, label, description, required, position, config)
  SELECT
    (e ->> 'id')::uuid,
    p_form_id,
    e ->> 'key',
    e ->> 'type',
    e ->> 'label',
    NULLIF(e ->> 'description', ''),
    COALESCE((e ->> 'required')::boolean, FALSE),
    (e ->> 'position')::int,
    e - 'id' - 'key' - 'type' - 'label' - 'description' - 'required' - 'position'
  FROM jsonb_array_elements(p_fields) e
  ON CONFLICT (id) DO UPDATE SET
    field_key = EXCLUDED.field_key,
    type = EXCLUDED.type,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    required = EXCLUDED.required,
    position = EXCLUDED.position,
    config = EXCLUDED.config
  -- Never let a field id hop between forms.
  WHERE public.form_fields.form_id = p_form_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC: submit_response
-- Single transaction: lock form row → check status/limit/idempotency →
-- insert response + answers → increment counter.
-- p_answers: { "<field uuid>": <json value>, ... }
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_response(
  p_form_id UUID,
  p_answers JSONB,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_submission_id UUID DEFAULT NULL
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

  INSERT INTO public.responses (form_id, metadata, submission_id)
  VALUES (p_form_id, COALESCE(p_metadata, '{}'::jsonb), p_submission_id)
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

-- RPCs are for the API (service role) only.
REVOKE ALL ON FUNCTION public.sync_form_fields(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_response(UUID, JSONB, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_form_fields(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_response(UUID, JSONB, JSONB, UUID) TO service_role;

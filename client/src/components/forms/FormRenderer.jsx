import { FILE_UPLOAD, allowedExtensions, fileExtension, validateAnswer, validateAnswers } from '@afb/shared';
import { BadgeCheck, FileText, Loader2, Star, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { formatBytes } from '../../utils/format.js';
import { renderGoogleButton } from '../../utils/google.js';
import { Button, Field, Input, Select, Textarea, cn } from '../ui/index.jsx';

const INPUT_TYPES = { text: 'text', email: 'email', phone: 'tel', number: 'number', date: 'date' };
const AUTOCOMPLETE = { email: 'email', phone: 'tel' };

function Choice({ type, name, checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition-colors hover:border-brand-500 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
      <input type={type} name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-brand-600" />
      <span>{children}</span>
    </label>
  );
}

function RatingInput({ field, value, onChange, id }) {
  const scale = field.scale ?? 5;
  return (
    <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex gap-1">
      {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of ${scale}`}
          onClick={() => onChange(value === n ? undefined : n)}
          className="cursor-pointer rounded p-1 transition-transform hover:scale-110"
        >
          <Star className={cn('h-7 w-7', n <= (value ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
        </button>
      ))}
    </div>
  );
}

/** Client-side pre-check. The server re-validates type, size and contents. */
export function checkFile(field, file) {
  const allowed = allowedExtensions(field);
  if (!allowed.includes(fileExtension(file.name))) {
    return `That file type isn't allowed. Use: ${allowed.map((e) => `.${e}`).join(', ')}.`;
  }
  if (file.size === 0) return 'That file is empty.';
  if (file.size > FILE_UPLOAD.MAX_BYTES) {
    return `That file is larger than ${FILE_UPLOAD.MAX_LABEL}. Please choose a smaller one.`;
  }
  return null;
}

function FileInput({ field, value, a11y, uploading, onPick, onClear }) {
  const allowed = allowedExtensions(field);
  const hint = `${allowed.map((e) => `.${e}`).join(', ')} · up to ${FILE_UPLOAD.MAX_LABEL}`;

  if (uploading) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm" role="status">
        <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden /> Uploading {uploading}…
      </div>
    );
  }
  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          <span className="truncate font-medium">{value.name}</span>
          <span className="shrink-0 text-slate-500">{formatBytes(value.size)}</span>
        </span>
        <Button size="sm" variant="ghost" onClick={onClear} aria-label={`Remove ${value.name}`}>
          <X className="h-4 w-4" aria-hidden /> Remove
        </Button>
      </div>
    );
  }
  return (
    <div>
      <input
        id={a11y.id}
        type="file"
        accept={allowed.map((e) => `.${e}`).join(',')}
        aria-describedby={a11y['aria-describedby']}
        aria-invalid={a11y.invalid || undefined}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // allow choosing the same file again after an error
          if (file) onPick(file);
        }}
        className="block w-full cursor-pointer rounded-md border border-slate-300 bg-white text-sm text-slate-600 file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-slate-300 file:bg-slate-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
      />
      <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

/** Email question that is confirmed by signing in with Google instead of typing the address. */
function GoogleEmail({ value, a11y, clientId, preview, busy, onCredential, onClear }) {
  const holder = useRef(null);
  const latest = useRef(onCredential);
  latest.current = onCredential;
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (value || busy || preview || !clientId || !holder.current) return undefined;
    let cancelled = false;
    setLoadError('');
    renderGoogleButton(holder.current, clientId, (credential) => latest.current(credential)).catch(
      (err) => !cancelled && setLoadError(err.message),
    );
    return () => { cancelled = true; };
  }, [value, busy, preview, clientId]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          <span className="truncate font-medium">{value}</span>
          <span className="shrink-0 text-slate-500">Verified with Google</span>
        </span>
        <Button size="sm" variant="ghost" onClick={onClear} aria-label="Use a different Google account">Change</Button>
      </div>
    );
  }
  if (busy) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm" role="status">
        <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden /> Verifying with Google…
      </div>
    );
  }
  if (!preview && !clientId) {
    return <p className="rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-800">Email verification isn't available right now. Please try again later.</p>;
  }
  return (
    <div>
      {preview ? (
        <div id={a11y.id}>
          <Button variant="secondary" onClick={() => onCredential('preview')}>Continue with Google (preview)</Button>
        </div>
      ) : (
        <div ref={holder} id={a11y.id} className="min-h-[44px]" />
      )}
      <p className="mt-1.5 text-xs text-slate-500">Sign in with Google to confirm your email address. We only receive your email address.</p>
      {loadError && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{loadError}</p>}
    </div>
  );
}

/** Renders the right control for a field. `a11y` comes from <Field>. */
function Control({ field, value, onChange, onBlur, a11y, uploading, onPickFile, google }) {
  const { id, invalid } = a11y;

  if (field.type === 'email' && field.verifyEmail) {
    return (
      <GoogleEmail value={value} a11y={a11y} clientId={google.clientId} preview={google.preview}
        busy={google.busy} onCredential={google.onCredential} onClear={google.onClear} />
    );
  }
  const common = { id, invalid, onBlur, 'aria-describedby': a11y['aria-describedby'] };

  switch (field.type) {
    case 'textarea':
      return (
        <Textarea
          {...common}
          rows={4}
          value={value ?? ''}
          maxLength={field.maxLength ?? 5000}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'select':
      return (
        <Select {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.placeholder || 'Select an option…'}</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      );
    case 'radio':
      return (
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="space-y-2" onBlur={onBlur}>
          {(field.options ?? []).map((o) => (
            <Choice key={o} type="radio" name={field.id} checked={value === o} onChange={() => onChange(o)}>{o}</Choice>
          ))}
        </div>
      );
    case 'checkbox': {
      const selected = value ?? [];
      return (
        <div role="group" aria-labelledby={`${id}-label`} className="space-y-2" onBlur={onBlur}>
          {(field.options ?? []).map((o) => (
            <Choice
              key={o}
              type="checkbox"
              name={field.id}
              checked={selected.includes(o)}
              onChange={(e) => onChange(e.target.checked ? [...selected, o] : selected.filter((s) => s !== o))}
            >
              {o}
            </Choice>
          ))}
        </div>
      );
    }
    case 'boolean':
      return (
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid grid-cols-2 gap-2" onBlur={onBlur}>
          <Choice type="radio" name={field.id} checked={value === true} onChange={() => onChange(true)}>Yes</Choice>
          <Choice type="radio" name={field.id} checked={value === false} onChange={() => onChange(false)}>No</Choice>
        </div>
      );
    case 'file':
      return (
        <FileInput field={field} value={value} a11y={a11y} uploading={uploading}
          onPick={onPickFile} onClear={() => onChange(undefined)} />
      );
    case 'rating':
      return <RatingInput field={field} value={value} id={id} onChange={onChange} />;
    case 'number':
      return (
        <Input
          {...common}
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <Input
          {...common}
          type={INPUT_TYPES[field.type] ?? 'text'}
          autoComplete={AUTOCOMPLETE[field.type]}
          value={value ?? ''}
          maxLength={field.maxLength ?? 500}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

/**
 * Dynamic form. Validates with the same shared rules as the backend.
 * `onSubmit(answers)` may throw an ApiError whose `details` ([{path, message}]) map to field errors.
 */
export function FormRenderer({
  fields, onSubmit, uploadFile, googleClientId, verifyEmail, disabled = false, submitLabel = 'Submit', preview = false,
}) {
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  /** field key → name of the file currently uploading */
  const [uploading, setUploading] = useState({});
  /** field key → proof from the server that Google confirmed the address */
  const [verifications, setVerifications] = useState({});
  const [verifying, setVerifying] = useState({});
  const formRef = useRef(null);
  const formId = useId();

  const setError = (key, message) =>
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });

  const handleChange = (field, value) => {
    setAnswers((prev) => ({ ...prev, [field.key]: value }));
    if (touched[field.key] || errors[field.key]) setError(field.key, validateAnswer(field, value));
  };

  const handlePickFile = async (field, file) => {
    const problem = checkFile(field, file);
    if (problem) return setError(field.key, problem);
    setError(field.key, null);
    setFormError('');

    // Preview mode never sends anything: fake a reference so the form can be tried out.
    if (preview || !uploadFile) {
      const ref = `${crypto.randomUUID()}/${crypto.randomUUID()}.${fileExtension(file.name)}`;
      return handleChange(field, { path: ref, name: file.name, size: file.size });
    }
    setUploading((u) => ({ ...u, [field.key]: file.name }));
    try {
      handleChange(field, await uploadFile(field, file));
    } catch (err) {
      setError(field.key, err.message);
    } finally {
      setUploading((u) => {
        const next = { ...u };
        delete next[field.key];
        return next;
      });
    }
  };

  const handleGoogleCredential = async (field, credential) => {
    setError(field.key, null);
    setFormError('');
    if (preview || !verifyEmail) return handleChange(field, 'preview.user@example.com');
    setVerifying((v) => ({ ...v, [field.key]: true }));
    try {
      const { email, verification } = await verifyEmail(field, credential);
      setVerifications((v) => ({ ...v, [field.key]: verification }));
      handleChange(field, email);
    } catch (err) {
      setError(field.key, err.message);
    } finally {
      setVerifying((v) => {
        const next = { ...v };
        delete next[field.key];
        return next;
      });
    }
  };

  const clearVerification = (key) => {
    setVerifications((v) => {
      const next = { ...v };
      delete next[key];
      return next;
    });
    setAnswers((a) => ({ ...a, [key]: undefined }));
  };

  const handleBlur = (field) => {
    setTouched((t) => ({ ...t, [field.key]: true }));
    setError(field.key, validateAnswer(field, answers[field.key]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const result = validateAnswers(fields, answers);
    if (!result.success) {
      setErrors(result.errors);
      const firstKey = fields.find((f) => result.errors[f.key])?.key;
      formRef.current?.querySelector(`[data-field="${firstKey}"] :is(input, select, textarea, button)`)?.focus();
      return;
    }
    if (preview) return;

    setSubmitting(true);
    try {
      await onSubmit(result.data, verifications);
    } catch (err) {
      if (Array.isArray(err.details)) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])));
      }
      // An expired or rejected proof means the respondent has to sign in again.
      if (err.code === 'EMAIL_NOT_VERIFIED') (err.details ?? []).forEach((d) => clearVerification(d.path));
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate aria-labelledby={`${formId}-title`} className="space-y-6">
      {fields.map((field) => (
        <div key={field.id} data-field={field.key}>
          <Field label={field.label} hint={field.description} error={errors[field.key]} required={field.required}>
            {(a11y) => (
              <>
                <span id={`${a11y.id}-label`} className="sr-only">{field.label}</span>
                <Control field={field} value={answers[field.key]} a11y={a11y}
                  uploading={uploading[field.key]} onPickFile={(file) => handlePickFile(field, file)}
                  google={{
                    clientId: googleClientId,
                    preview,
                    busy: Boolean(verifying[field.key]),
                    onCredential: (credential) => handleGoogleCredential(field, credential),
                    onClear: () => clearVerification(field.key),
                  }}
                  onChange={(v) => handleChange(field, v)} onBlur={() => handleBlur(field)} />
              </>
            )}
          </Field>
        </div>
      ))}

      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>
      )}

      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={submitting} disabled={disabled || Object.keys(uploading).length > 0 || Object.keys(verifying).length > 0}>
        {submitLabel}
      </Button>
      {preview && <p className="text-xs text-slate-500">Preview only — nothing is submitted.</p>}
    </form>
  );
}

import { FIELD_TYPES, FIELD_TYPE_META, FILE_UPLOAD, LIMITS, allowedExtensions, isOptionType } from '@afb/shared';
import { Plus, X } from 'lucide-react';
import { Button, Field, Input, Select, Textarea } from '../ui/index.jsx';

const numOrUndef = (v) => (v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));

function OptionsEditor({ options = [], onChange }) {
  const set = (i, value) => onChange(options.map((o, idx) => (idx === i ? value : o)));
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">Options</span>
      <ul className="space-y-2">
        {options.map((option, i) => (
          <li key={i} className="flex gap-2">
            <Input
              aria-label={`Option ${i + 1}`}
              value={option}
              maxLength={LIMITS.OPTION_MAX}
              onChange={(e) => set(i, e.target.value)}
            />
            <Button
              size="icon"
              variant="ghost"
              className="mt-1 shrink-0"
              aria-label={`Remove option ${i + 1}`}
              disabled={options.length <= 1}
              onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="secondary"
        disabled={options.length >= LIMITS.MAX_OPTIONS}
        onClick={() => onChange([...options, `Option ${options.length + 1}`])}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden /> Add option
      </Button>
      {new Set(options.map((o) => o.trim().toLowerCase())).size !== options.length && (
        <p role="alert" className="text-xs font-medium text-amber-700">Options must be unique and not empty.</p>
      )}
    </div>
  );
}

const FILE_GROUPS = [
  { label: 'PDF', exts: ['pdf'] },
  { label: 'Word', exts: ['doc', 'docx'] },
  { label: 'Images', exts: ['jpg', 'jpeg', 'png'] },
];

function FileTypesEditor({ field, onChange }) {
  const selected = allowedExtensions(field);
  const toggle = (exts, on) => {
    const next = FILE_UPLOAD.EXTENSIONS.filter((e) => (exts.includes(e) ? on : selected.includes(e)));
    // Nothing ticked would mean "no uploads"; fall back to allowing everything instead.
    onChange(next.length === FILE_UPLOAD.EXTENSIONS.length || next.length === 0 ? undefined : next);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">Accepted files</legend>
      {FILE_GROUPS.map(({ label, exts }) => (
        <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={exts.every((e) => selected.includes(e))}
            onChange={(e) => toggle(exts, e.target.checked)}
          />
          {label} <span className="text-slate-400">{exts.map((e) => `.${e}`).join(' ')}</span>
        </label>
      ))}
      <p className="text-xs text-slate-500">Each file can be up to {FILE_UPLOAD.MAX_LABEL}. Respondents upload one file.</p>
    </fieldset>
  );
}

export function FieldSettings({ field, onChange, onChangeType, typeLocked, error }) {
  if (!field) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        Select a question to edit its settings.
      </p>
    );
  }
  const patch = (p) => onChange(field.id, p);

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question settings</h2>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Field label="Label" required>
        {(a) => (
          <Input
            {...a}
            value={field.label}
            maxLength={LIMITS.LABEL_MAX}
            onChange={(e) => patch({ label: e.target.value })}
          />
        )}
      </Field>

      <Field label="Description" hint="Shown under the question.">
        {(a) => (
          <Textarea {...a} rows={2} value={field.description ?? ''} maxLength={LIMITS.FIELD_DESCRIPTION_MAX}
            onChange={(e) => patch({ description: e.target.value })} />
        )}
      </Field>

      <Field label="Type" hint={typeLocked ? 'Locked because this form already has responses.' : undefined}>
        {(a) => (
          <Select {...a} value={field.type} disabled={typeLocked} onChange={(e) => onChangeType(field.id, e.target.value)}>
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_META[t].label}</option>)}
          </Select>
        )}
      </Field>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={field.required}
          onChange={(e) => patch({ required: e.target.checked })} />
        Required
      </label>

      {['text', 'textarea', 'email', 'phone', 'number'].includes(field.type) && (
        <Field label="Placeholder">
          {(a) => <Input {...a} value={field.placeholder ?? ''} maxLength={LIMITS.PLACEHOLDER_MAX} onChange={(e) => patch({ placeholder: e.target.value })} />}
        </Field>
      )}

      {isOptionType(field.type) && <OptionsEditor options={field.options} onChange={(options) => patch({ options })} />}

      {field.type === 'email' && (
        <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand-600"
            checked={Boolean(field.verifyEmail)}
            onChange={(e) => patch({ verifyEmail: e.target.checked || undefined, ...(e.target.checked ? {} : { uniqueEmail: undefined }) })}
          />
          <span>
            Verify with Google sign-in
            <span className="block text-xs text-slate-500">
              Respondents confirm the address by signing in with Google instead of typing it. Needs GOOGLE_CLIENT_ID on the server. One per form.
            </span>
          </span>
        </label>
      )}

      {field.type === 'email' && field.verifyEmail && (
        <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand-600"
            checked={Boolean(field.uniqueEmail)}
            onChange={(e) => patch({ uniqueEmail: e.target.checked || undefined })}
          />
          <span>
            One response per verified email
            <span className="block text-xs text-slate-500">Each Google account can submit this form once.</span>
          </span>
        </label>
      )}

      {field.type === 'file' && <FileTypesEditor field={field} onChange={(fileTypes) => patch({ fileTypes })} />}

      {field.type === 'rating' && (
        <Field label="Scale">
          {(a) => (
            <Select {...a} value={field.scale ?? 5} onChange={(e) => patch({ scale: Number(e.target.value) })}>
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>1 to {n} stars</option>)}
            </Select>
          )}
        </Field>
      )}

      {field.type === 'number' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum">
            {(a) => <Input {...a} type="number" value={field.min ?? ''} onChange={(e) => patch({ min: numOrUndef(e.target.value) })} />}
          </Field>
          <Field label="Maximum">
            {(a) => <Input {...a} type="number" value={field.max ?? ''} onChange={(e) => patch({ max: numOrUndef(e.target.value) })} />}
          </Field>
        </div>
      )}

      {(field.type === 'text' || field.type === 'textarea') && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min length">
            {(a) => <Input {...a} type="number" min={0} value={field.minLength ?? ''} onChange={(e) => patch({ minLength: numOrUndef(e.target.value) })} />}
          </Field>
          <Field label="Max length">
            {(a) => <Input {...a} type="number" min={1} value={field.maxLength ?? ''} onChange={(e) => patch({ maxLength: numOrUndef(e.target.value) })} />}
          </Field>
        </div>
      )}

      <Field label="Field key" hint="Used in exports and analytics. Changing it won't affect past responses.">
        {(a) => (
          <Input {...a} className="font-mono text-xs" value={field.key} maxLength={LIMITS.KEY_MAX}
            onChange={(e) => patch({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, '') })} />
        )}
      </Field>
    </div>
  );
}

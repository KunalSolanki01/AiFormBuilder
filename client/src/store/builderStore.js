import { arrayMove } from '@dnd-kit/sortable';
import { createField, uniqueKey, toFieldKey } from '@afb/shared';
import { create } from 'zustand';

const renumber = (fields) => fields.map((f, i) => ({ ...f, position: i }));

const initial = {
  formId: null,
  title: '',
  description: '',
  type: 'survey',
  status: 'draft',
  slug: null,
  responseLimit: null,
  responseCount: 0,
  fields: [],
  selectedId: null,
  /** Ids of fields already saved on the server (their type is locked once responses exist). */
  persistedIds: [],
  dirty: false,
};

export const useBuilder = create((set, get) => ({
  ...initial,

  load(form) {
    set({
      ...initial,
      formId: form.id ?? null,
      title: form.title,
      description: form.description ?? '',
      type: form.type ?? 'survey',
      status: form.status ?? 'draft',
      slug: form.slug ?? null,
      responseLimit: form.response_limit ?? null,
      responseCount: form.response_count ?? 0,
      fields: renumber(form.fields ?? []),
      selectedId: form.fields?.[0]?.id ?? null,
      persistedIds: (form.fields ?? []).map((f) => f.id),
    });
  },

  /** Marks the current state as saved, optionally merging server-side values. */
  markSaved(form) {
    set({
      dirty: false,
      persistedIds: get().fields.map((f) => f.id),
      ...(form && { status: form.status, slug: form.slug, responseCount: form.response_count ?? get().responseCount }),
    });
  },

  setMeta(patch) {
    set({ ...patch, dirty: true });
  },

  select: (id) => set({ selectedId: id }),

  addField(type, atIndex) {
    const { fields } = get();
    const field = createField(type, new Set(fields.map((f) => f.key)));
    const next = [...fields];
    next.splice(atIndex ?? next.length, 0, field);
    set({ fields: renumber(next), selectedId: field.id, dirty: true });
    return field.id;
  },

  updateField(id, patch) {
    set({ fields: get().fields.map((f) => (f.id === id ? { ...f, ...patch } : f)), dirty: true });
  },

  /** Changing type resets type-specific config so stale options/scale don't linger. */
  changeFieldType(id, type) {
    const current = get().fields.find((f) => f.id === id);
    if (!current || current.type === type) return;
    const fresh = createField(type, new Set(), { label: current.label });
    const { options, scale } = fresh;
    const { options: _o, scale: _s, min: _min, max: _max, minLength: _a, maxLength: _b, ...rest } = current;
    set({
      fields: get().fields.map((f) =>
        f.id === id ? { ...rest, type, ...(options && { options: current.options?.length ? current.options : options }), ...(scale && { scale }) } : f,
      ),
      dirty: true,
    });
  },

  removeField(id) {
    const { fields, selectedId } = get();
    const index = fields.findIndex((f) => f.id === id);
    const next = renumber(fields.filter((f) => f.id !== id));
    set({
      fields: next,
      selectedId: selectedId === id ? (next[Math.min(index, next.length - 1)]?.id ?? null) : selectedId,
      dirty: true,
    });
  },

  /**
   * Form-level switch for "verify respondents' email with Google".
   * On: the form's first email question requires verification (one is added at the top if the form has none).
   * Off: no question requires it. Only one verified email question is allowed per form.
   */
  setEmailVerification(on) {
    const { fields } = get();
    if (!on) {
      set({
        fields: fields.map((f) => (f.verifyEmail || f.uniqueEmail ? { ...f, verifyEmail: undefined, uniqueEmail: undefined } : f)),
        dirty: true,
      });
      return;
    }
    const first = fields.findIndex((f) => f.type === 'email');
    if (first >= 0) {
      set({
        fields: fields.map((f, i) =>
          f.type === 'email'
            ? { ...f, verifyEmail: i === first ? true : undefined, uniqueEmail: i === first ? f.uniqueEmail : undefined }
            : f,
        ),
        selectedId: fields[first].id,
        dirty: true,
      });
      return;
    }
    const email = createField('email', new Set(fields.map((f) => f.key)), { label: 'Email address', required: true });
    set({ fields: renumber([{ ...email, verifyEmail: true }, ...fields]), selectedId: email.id, dirty: true });
  },

  /** One response per verified email. Only meaningful while email verification is on. */
  setUniqueEmail(on) {
    const { fields } = get();
    set({
      fields: fields.map((f) => (f.type === 'email' && f.verifyEmail ? { ...f, uniqueEmail: on || undefined } : f)),
      dirty: true,
    });
  },

  duplicateField(id) {
    const { fields } = get();
    const index = fields.findIndex((f) => f.id === id);
    if (index < 0) return;
    const source = fields[index];
    const copy = {
      ...structuredClone(source),
      id: crypto.randomUUID(),
      key: uniqueKey(toFieldKey(source.key), new Set(fields.map((f) => f.key))),
      label: `${source.label} (copy)`.slice(0, 200),
      verifyEmail: undefined,
      uniqueEmail: undefined,
    };
    const next = [...fields];
    next.splice(index + 1, 0, copy);
    set({ fields: renumber(next), selectedId: copy.id, dirty: true });
  },

  moveField(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    set({ fields: renumber(arrayMove(get().fields, fromIndex, toIndex)), dirty: true });
  },

  /** Payload for POST/PUT /api/forms. */
  toPayload() {
    const { title, description, type, fields, responseLimit } = get();
    return { title, description, type, fields, response_limit: responseLimit };
  },
}));

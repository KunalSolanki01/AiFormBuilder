import { FORM_TYPES, formContentSchema, formatZodError } from '@afb/shared';
import { BarChart3, Check, Copy, Eye, Inbox, Lock, Rocket, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Canvas } from '../components/builder/Canvas.jsx';
import { FieldPalette } from '../components/builder/FieldPalette.jsx';
import { FieldSettings } from '../components/builder/FieldSettings.jsx';
import { FormNotFound } from '../components/ui/FormNotFound.jsx';
import { Badge, Button, EmptyState, ErrorBanner, Field, Input, Modal, Select, Skeleton, Textarea } from '../components/ui/index.jsx';
import { api } from '../services/api.js';
import { useBuilder } from '../store/builderStore.js';
import { copyToClipboard, publicUrl } from '../utils/format.js';

export default function FormBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const b = useBuilder();
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(null); // 'save' | 'publish' | 'close' | 'preview'
  const [issues, setIssues] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState(null);

  const load = useCallback(async () => {
    setLoadError('');
    setNotFound(false);
    setLoaded(false);
    try {
      b.load(await api.forms.get(id));
      setLoaded(true);
    } catch (err) {
      setNotFound(err.status === 404);
      setLoadError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Warn before losing unsaved edits.
  useEffect(() => {
    if (!b.dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [b.dirty]);

  const selected = b.fields.find((f) => f.id === b.selectedId) ?? null;
  const emailVerification = b.fields.some((f) => f.type === 'email' && f.verifyEmail);
  const onePerEmail = b.fields.some((f) => f.type === 'email' && f.verifyEmail && f.uniqueEmail);
  const issueFor = useCallback(
    (index) => issues.find((i) => i.path.startsWith(`fields.${index}`))?.message,
    [issues],
  );
  const selectedIndex = b.fields.findIndex((f) => f.id === b.selectedId);

  /** Validates locally with the same schema as the API, then persists. Returns the saved form or null. */
  const save = useMemo(
    () => async () => {
      const state = useBuilder.getState();
      const check = formContentSchema.safeParse({
        title: state.title, description: state.description, type: state.type, fields: state.fields,
      });
      if (!check.success) {
        const list = formatZodError(check.error);
        setIssues(list);
        const idx = Number(list.find((i) => i.path.startsWith('fields.'))?.path.split('.')[1]);
        if (Number.isInteger(idx) && state.fields[idx]) state.select(state.fields[idx].id);
        toast.error(list[0]?.message ?? 'Please fix the highlighted problems.');
        return null;
      }
      setIssues([]);
      try {
        const saved = await api.forms.update(id, state.toPayload());
        state.markSaved(saved);
        return saved;
      } catch (err) {
        toast.error(err.message);
        return null;
      }
    },
    [id],
  );

  const run = (name, fn) => async () => {
    setBusy(name);
    try { await fn(); } finally { setBusy(null); }
  };

  const onSave = run('save', async () => { if (await save()) toast.success('Draft saved'); });

  const onPreview = run('preview', async () => {
    if (b.dirty && !(await save())) return;
    navigate(`/builder/${id}/preview`);
  });

  const onPublish = run('publish', async () => {
    if (!(await save())) return;
    try {
      const form = await api.forms.publish(id);
      b.markSaved(form);
      setShareOpen(true);
    } catch (err) {
      toast.error(err.message);
    }
  });

  const onClose = run('close', async () => {
    try {
      b.markSaved(await api.forms.close(id));
      toast.success('Form closed — it no longer accepts responses.');
      setConfirmClose(false);
    } catch (err) {
      toast.error(err.message);
    }
  });

  if (notFound) return <FormNotFound />;
  if (loadError) {
    return <div className="mx-auto max-w-2xl px-4 py-12"><ErrorBanner onRetry={load}>{loadError}</ErrorBanner><Link to="/dashboard" className="mt-4 inline-block text-sm text-brand-600 underline">Back to dashboard</Link></div>;
  }
  if (!loaded) {
    return <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[220px_1fr_300px]"><Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;
  }

  const published = b.status === 'published';
  const closed = b.status === 'closed';
  const url = b.slug ? publicUrl(b.slug) : '';

  return (
    <div>
      <div className="sticky top-14 z-20 border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="flex min-w-0 flex-1 basis-full items-center gap-3 lg:basis-0">
            <label htmlFor="form-name" className="sr-only">Form name</label>
            <input
              id="form-name"
              value={b.title}
              maxLength={150}
              onChange={(e) => b.setMeta({ title: e.target.value })}
              className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-lg font-semibold hover:bg-slate-100 focus:bg-white"
              placeholder="Untitled form"
            />
            <Badge tone={b.status}>{b.status}</Badge>
            {b.dirty && <span className="text-xs text-amber-600" role="status">Unsaved changes</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(published || closed) && (
              <>
                <Link to={`/builder/${id}/responses`}><Button size="sm" variant="ghost"><Inbox className="h-4 w-4" aria-hidden /> {b.responseCount}</Button></Link>
                <Link to={`/builder/${id}/analytics`}><Button size="sm" variant="ghost"><BarChart3 className="h-4 w-4" aria-hidden /> Analytics</Button></Link>
              </>
            )}
            <Button size="sm" variant="secondary" onClick={onPreview} loading={busy === 'preview'} disabled={!!busy || !b.fields.length}>
              <Eye className="h-4 w-4" aria-hidden /> Preview
            </Button>
            <Button size="sm" variant="secondary" onClick={onSave} loading={busy === 'save'} disabled={!!busy || !b.dirty}>
              <Save className="h-4 w-4" aria-hidden /> Save
            </Button>
            {published && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setShareOpen(true)}><Copy className="h-4 w-4" aria-hidden /> Share</Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirmClose(true)} disabled={!!busy}><Lock className="h-4 w-4" aria-hidden /> Close</Button>
              </>
            )}
            <Button size="sm" variant="ai" onClick={onPublish} loading={busy === 'publish'} disabled={!!busy || !b.fields.length}>
              <Rocket className="h-4 w-4" aria-hidden /> {published ? 'Save & republish' : closed ? 'Reopen' : 'Publish'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside aria-label="Field types"><FieldPalette onAdd={(t) => b.addField(t)} disabled={b.fields.length >= 50} /></aside>

        <section aria-label="Form canvas" className="space-y-4">
          {b.responseCount > 0 && (
            <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              This form has {b.responseCount} {b.responseCount === 1 ? 'response' : 'responses'}. You can edit questions, but existing question types are locked.
            </p>
          )}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <Field label="Description" hint="Shown to respondents above the questions.">
              {(a) => <Textarea {...a} rows={2} maxLength={1000} value={b.description} onChange={(e) => b.setMeta({ description: e.target.value })} />}
            </Field>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Form type">
                {(a) => <Select {...a} value={b.type} onChange={(e) => b.setMeta({ type: e.target.value })}>{FORM_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</Select>}
              </Field>
              <Field label="Response limit" hint={b.responseLimit ? `${Math.max(0, b.responseLimit - b.responseCount)} spots remaining` : 'Leave empty for unlimited.'}>
                {(a) => (
                  <Input {...a} type="number" min={Math.max(1, b.responseCount)} placeholder="Unlimited" value={b.responseLimit ?? ''}
                    onChange={(e) => b.setMeta({ responseLimit: e.target.value === '' ? null : Math.max(1, Math.floor(Number(e.target.value))) })} />
                )}
              </Field>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:border-slate-400">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-brand-600"
                checked={emailVerification}
                onChange={(e) => b.setEmailVerification(e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium text-slate-900">Verify respondents&apos; email with Google</span>
                <span className="mt-0.5 block text-slate-500">
                  People sign in with Google before they can submit, so every response has a confirmed email address.
                  {!b.fields.some((f) => f.type === 'email') && ' A required Email question will be added.'}
                </span>
              </span>
            </label>

            <label
              className={`mt-3 flex items-start gap-3 rounded-md border border-slate-200 p-3 ${emailVerification ? 'cursor-pointer hover:border-slate-400' : 'opacity-60'}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-brand-600"
                checked={onePerEmail}
                disabled={!emailVerification}
                onChange={(e) => b.setUniqueEmail(e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium text-slate-900">One response per verified email</span>
                <span className="mt-0.5 block text-slate-500">
                  Each Google account can submit this form once. {emailVerification ? 'Anyone who has already responded is told right after they sign in.' : 'Turn on email verification first.'}
                </span>
              </span>
            </label>
          </div>

          {b.fields.length === 0 ? (
            <EmptyState title="No questions yet">Pick a question type on the left to get started.</EmptyState>
          ) : (
            <Canvas fields={b.fields} selectedId={b.selectedId} onSelect={b.select}
              onMove={b.moveField} onDuplicate={b.duplicateField} onDelete={(fieldId) => setFieldToDelete(b.fields.find((f) => f.id === fieldId) ?? null)} />
          )}
          {issues.length > 0 && !issues.some((i) => i.path.startsWith('fields.')) && (
            <ErrorBanner>{issues[0].message}</ErrorBanner>
          )}
        </section>

        <aside aria-label="Question settings" className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <FieldSettings
              field={selected}
              onChange={b.updateField}
              onChangeType={b.changeFieldType}
              typeLocked={b.responseCount > 0 && b.persistedIds.includes(b.selectedId)}
              error={selectedIndex >= 0 ? issueFor(selectedIndex) : undefined}
            />
          </div>
        </aside>
      </div>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Your form is live"
        footer={<Button onClick={() => setShareOpen(false)}>Done</Button>}>
        <p>Anyone with this link can fill in your form.</p>
        <div className="mt-3 flex gap-2">
          <Input readOnly value={url} aria-label="Public form link" onFocus={(e) => e.target.select()} />
          <Button variant="secondary" onClick={async () => ((await copyToClipboard(url)) ? toast.success('Link copied') : toast.error('Copy failed — select the link and copy it manually.'))}>
            <Check className="h-4 w-4" aria-hidden /> Copy
          </Button>
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-brand-600 underline">Open form</a>
      </Modal>

      <Modal
        open={Boolean(fieldToDelete)}
        onClose={() => setFieldToDelete(null)}
        title="Delete this question?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFieldToDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => { b.removeField(fieldToDelete.id); setFieldToDelete(null); }}
            >
              Delete question
            </Button>
          </>
        }
      >
        “{fieldToDelete?.label || 'Untitled question'}” will be removed from the form.
        {fieldToDelete && b.responseCount > 0 && b.persistedIds.includes(fieldToDelete.id) && (
          <strong className="mt-2 block text-slate-900">
            This form has {b.responseCount} {b.responseCount === 1 ? 'response' : 'responses'}. Their answers to this
            question will no longer be shown once you save.
          </strong>
        )}
      </Modal>

      <Modal open={confirmClose} onClose={() => setConfirmClose(false)} title="Close this form?"
        footer={<><Button variant="secondary" onClick={() => setConfirmClose(false)}>Cancel</Button><Button onClick={onClose} loading={busy === 'close'}>Close form</Button></>}>
        It will stop accepting responses. Existing responses stay available, and you can reopen it later.
      </Modal>
    </div>
  );
}

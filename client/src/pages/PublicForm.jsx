import { CheckCircle2, Lock, SearchX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FormRenderer } from '../components/forms/FormRenderer.jsx';
import { Button, Skeleton } from '../components/ui/index.jsx';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { api } from '../services/api.js';

function Shell({ children }) {
  return (
    <div className="min-h-screen px-4 py-8 sm:py-14">
      <div className="mx-auto mb-4 flex max-w-xl justify-end"><ThemeToggle /></div>
      <div className="mx-auto max-w-xl">{children}</div>
      <p className="mt-8 text-center text-xs text-slate-500">
        Made with AI Form Builder · <Link to="/privacy" className="underline underline-offset-2 hover:text-slate-700">Privacy</Link> ·{' '}
        <Link to="/terms" className="underline underline-offset-2 hover:text-slate-700">Terms</Link>
      </p>
    </div>
  );
}

function Notice({ icon: Icon, tone = 'text-slate-500', title, children }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-10 text-center" role="status">
      <Icon className={`mx-auto mb-4 h-9 w-9 ${tone}`} strokeWidth={1.5} aria-hidden />
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{children}</p>
    </div>
  );
}

export default function PublicForm() {
  const { slug } = useParams();
  const [state, setState] = useState({ status: 'loading' }); // loading | ready | notfound | error | done
  // One id per page visit: retrying a failed/slow submit never double-counts.
  const submissionId = useRef(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    api.public.getForm(slug)
      .then((form) => !cancelled && setState({ status: 'ready', form }))
      .catch((err) => !cancelled && setState({ status: err.status === 404 ? 'notfound' : 'error', message: err.message }));
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (state.form?.title) document.title = state.form.title;
    return () => { document.title = 'AI Form Builder'; };
  }, [state.form?.title]);

  const handleSubmit = async (answers, verifications) => {
    try {
      await api.public.submit(slug, answers, submissionId.current, verifications);
      setState((s) => ({ ...s, status: 'done' }));
    } catch (err) {
      if (err.code === 'LIMIT_REACHED' || err.code === 'FORM_CLOSED') {
        setState((s) => ({ ...s, form: { ...s.form, accepting_responses: false, closed_reason: err.code === 'LIMIT_REACHED' ? 'limit_reached' : 'closed' } }));
      }
      throw err;
    }
  };

  if (state.status === 'loading') {
    return <Shell><Skeleton className="h-10 w-2/3" /><Skeleton className="mt-6 h-64" /></Shell>;
  }
  if (state.status === 'notfound') {
    return <Shell><Notice icon={SearchX} title="Form not found">This link may be wrong, or the form hasn&apos;t been published yet.</Notice></Shell>;
  }
  if (state.status === 'error') {
    return (
      <Shell>
        <Notice icon={SearchX} title="Couldn't load the form">{state.message}</Notice>
        <div className="mt-4 text-center"><Button onClick={() => window.location.reload()}>Try again</Button></div>
      </Shell>
    );
  }

  const { form } = state;
  if (state.status === 'done') {
    return <Shell><Notice icon={CheckCircle2} tone="text-emerald-500" title="Thank you!">Your response to “{form.title}” has been recorded.</Notice></Shell>;
  }

  if (!form.accepting_responses) {
    const limit = form.closed_reason === 'limit_reached';
    return (
      <Shell>
        <Notice icon={Lock} tone="text-amber-500" title={limit ? 'Registration is full' : 'This form is closed'}>
          {limit ? `“${form.title}” has reached its maximum number of responses.` : `“${form.title}” is no longer accepting responses.`}
        </Notice>
      </Shell>
    );
  }

  return (
    <Shell>
      <article className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold">{form.title}</h1>
        {form.description && <p className="mt-2 whitespace-pre-line text-slate-600">{form.description}</p>}
        {form.remaining != null && (
          <p className="mt-3 inline-block rounded bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            {form.remaining} {form.remaining === 1 ? 'spot' : 'spots'} remaining
          </p>
        )}
        <div className="mt-8">
          <FormRenderer
            fields={form.fields}
            onSubmit={handleSubmit}
            uploadFile={(field, file) => api.public.upload(slug, field.key, file)}
            googleClientId={form.google_client_id}
            verifyEmail={(field, credential) => api.public.verifyEmail(slug, field.key, credential)}
          />
        </div>
      </article>
    </Shell>
  );
}

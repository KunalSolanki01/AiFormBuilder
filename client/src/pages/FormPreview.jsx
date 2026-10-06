import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FormRenderer } from '../components/forms/FormRenderer.jsx';
import { FormNotFound } from '../components/ui/FormNotFound.jsx';
import { Badge, ErrorBanner, Skeleton } from '../components/ui/index.jsx';
import { api } from '../services/api.js';

export default function FormPreview() {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.forms.get(id).then(setForm).catch((e) => {
      setNotFound(e.status === 404);
      setError(e.message);
    });
  }, [id]);

  if (notFound) return <FormNotFound />;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link to={`/builder/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to builder
        </Link>
        <Badge>Preview</Badge>
      </div>
      <ErrorBanner>{error}</ErrorBanner>
      {!form && !error && <Skeleton className="h-96" />}
      {form && (
        <article className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
          <h1 className="font-display text-3xl font-semibold">{form.title}</h1>
          {form.description && <p className="mt-2 whitespace-pre-line text-slate-600">{form.description}</p>}
          <div className="mt-8"><FormRenderer fields={form.fields} preview onSubmit={() => {}} /></div>
        </article>
      )}
    </div>
  );
}

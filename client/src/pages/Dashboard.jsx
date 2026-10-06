import { FileText, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, EmptyState, ErrorBanner, Modal, Skeleton } from '../components/ui/index.jsx';
import { api } from '../services/api.js';
import { formatDate } from '../utils/format.js';

function Stat({ label, value }) {
  return (
    <div className="px-6 py-4 first:pl-0">
      <p className="font-display text-3xl font-medium tabular-nums">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [forms, setForms] = useState(null);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setForms(await api.forms.list());
    } catch (err) {
      setError(err.message);
      setForms((f) => f ?? []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.forms.remove(toDelete.id);
      setForms((fs) => fs.filter((f) => f.id !== toDelete.id));
      toast.success('Form deleted');
      setToDelete(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const totalResponses = forms?.reduce((s, f) => s + f.response_count, 0) ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-medium">Your forms</h1>
        <Button onClick={() => navigate('/create')}><Plus className="h-4 w-4" aria-hidden /> New form</Button>
      </div>

      <div className="mt-4"><ErrorBanner onRetry={load}>{error}</ErrorBanner></div>

      <div className="mt-6 flex divide-x divide-slate-200 border-y border-slate-200">
        {forms ? (
          <>
            <Stat label="Forms" value={forms.length} />
            <Stat label="Published" value={forms.filter((f) => f.status === 'published').length} />
            <Stat label="Responses" value={totalResponses} />
          </>
        ) : (
          <Skeleton className="my-4 h-12 w-full" />
        )}
      </div>

      {!forms ? (
        <div className="mt-8 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : forms.length === 0 && !error ? (
        <div className="mt-8">
          <EmptyState
            icon={FileText}
            title="No forms yet"
            action={<Button onClick={() => navigate('/create')}>Make your first form</Button>}
          >
            Describe what you need to ask and you will get a draft to edit.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-slate-200">
          {forms.map((form) => (
            <li key={form.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <Link to={`/builder/${form.id}`} className="truncate font-medium text-slate-900 hover:text-brand-600 hover:underline">
                    {form.title}
                  </Link>
                  <Badge tone={form.status}>{form.status}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {form.response_count}{form.response_limit ? ` of ${form.response_limit}` : ''} responses · edited {formatDate(form.updated_at)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link to={`/builder/${form.id}`}><Button size="sm" variant="ghost">Edit</Button></Link>
                <Link to={`/builder/${form.id}/responses`}><Button size="sm" variant="ghost">Responses</Button></Link>
                <Link to={`/builder/${form.id}/analytics`}><Button size="sm" variant="ghost">Analytics</Button></Link>
                <Button size="icon" variant="danger-ghost" aria-label={`Delete ${form.title}`} onClick={() => setToDelete(form)}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(toDelete)}
        onClose={() => !deleting && setToDelete(null)}
        title="Delete this form?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>Delete</Button>
          </>
        }
      >
        “{toDelete?.title}” and its {toDelete?.response_count ?? 0} responses will be deleted for good.
      </Modal>
    </div>
  );
}

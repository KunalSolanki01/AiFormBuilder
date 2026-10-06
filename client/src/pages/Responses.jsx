import { ArrowLeft, ArrowUpDown, BadgeCheck, BarChart3, ChevronLeft, ChevronRight, Download, Inbox, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FormNotFound } from '../components/ui/FormNotFound.jsx';
import { Button, Card, EmptyState, ErrorBanner, Input, Modal, Select, Skeleton } from '../components/ui/index.jsx';
import { api } from '../services/api.js';
import { formatAnswer, formatBytes, formatDateTime } from '../utils/format.js';

const PAGE_SIZE = 25;
const FILTERABLE = ['select', 'radio', 'checkbox', 'boolean'];

/** Fetches a 60-second signed URL (owner only) and starts the download. */
function FileLink({ formId, file }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const { url } = await api.forms.fileUrl(formId, file.path, file.name);
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        title={`Download ${file.name} (${formatBytes(file.size)})`}
        className="flex min-w-0 cursor-pointer items-center gap-1.5 font-medium text-brand-600 hover:underline disabled:opacity-60"
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{busy ? 'Preparing…' : file.name}</span>
      </button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

const VerifiedMark = () => (
  <span className="inline-flex shrink-0 items-center text-brand-600" title="Email verified with Google">
    <BadgeCheck className="h-4 w-4" aria-hidden />
    <span className="sr-only">Verified</span>
  </span>
);

const renderAnswer = (formId, field, value, verified) =>
  field.type === 'file' && value?.path ? (
    <FileLink formId={formId} file={value} />
  ) : verified && value ? (
    <span className="inline-flex max-w-full items-center gap-1.5"><span className="truncate">{formatAnswer(value)}</span><VerifiedMark /></span>
  ) : (
    formatAnswer(value)
  );

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Responses() {
  const { id } = useParams();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [filterField, setFilterField] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [data, setData] = useState(null);
  const [fields, setFields] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const debouncedSearch = useDebounced(search);

  useEffect(() => { setPage(1); }, [debouncedSearch, sort, filterField, filterValue]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.forms
      .responses(id, { search: debouncedSearch, sort, page, pageSize: PAGE_SIZE, field: filterField, value: filterValue })
      .then((res) => { if (!cancelled) { setData(res); setFields(res.fields); } })
      .catch((e) => {
        if (cancelled) return;
        setNotFound(e.status === 404);
        setError(e.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id, debouncedSearch, sort, page, filterField, filterValue]);

  useEffect(() => { api.forms.get(id).then((f) => setTitle(f.title)).catch(() => {}); }, [id]);

  if (notFound) return <FormNotFound />;

  const columns = fields.slice(0, 4);
  const filterable = fields.filter((f) => FILTERABLE.includes(f.type));
  const activeFilter = filterable.find((f) => f.key === filterField);
  const filterOptions = activeFilter ? (activeFilter.type === 'boolean' ? ['Yes', 'No'] : activeFilter.options) : [];
  const hasFilters = search || filterField;
  const total = data?.total ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link to={`/builder/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {title || 'Back to builder'}
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Responses</h1>
          <p className="text-sm text-slate-500">
            Total responses: <strong className="text-slate-900 tabular-nums">{data?.response_count ?? '—'}</strong>
          </p>
        </div>
        <Link to={`/builder/${id}/analytics`}><Button variant="secondary"><BarChart3 className="h-4 w-4" aria-hidden /> Analytics &amp; AI summary</Button></Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden />
          <Input aria-label="Search responses" className="pl-9" placeholder="Search responses…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {filterable.length > 0 && (
          <>
            <Select aria-label="Filter by question" className="w-48" value={filterField} onChange={(e) => { setFilterField(e.target.value); setFilterValue(''); }}>
              <option value="">Filter by…</option>
              {filterable.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </Select>
            {activeFilter && (
              <Select aria-label="Filter value" className="w-40" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
                <option value="">Any</option>
                {filterOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            )}
          </>
        )}
        <Button variant="secondary" onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}>
          <ArrowUpDown className="h-4 w-4" aria-hidden /> {sort === 'newest' ? 'Newest first' : 'Oldest first'}
        </Button>
        {hasFilters && (
          <Button variant="ghost" onClick={() => { setSearch(''); setFilterField(''); setFilterValue(''); }}>
            <X className="h-4 w-4" aria-hidden /> Clear
          </Button>
        )}
      </div>

      <ErrorBanner>{error}</ErrorBanner>

      {!data && loading ? (
        <Skeleton className="h-64" />
      ) : total === 0 && !error ? (
        <EmptyState icon={Inbox} title={hasFilters ? 'No matching responses' : 'No responses yet'}>
          {hasFilters ? 'Try a different search or clear the filters.' : 'Share your form link to start collecting responses.'}
        </EmptyState>
      ) : data && (
        <Card className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                {columns.map((c) => <th key={c.id} scope="col" className="px-4 py-3 font-medium">{c.label}</th>)}
                <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  {columns.map((c, i) => (
                    <td key={c.id} className="max-w-[16rem] truncate px-4 py-3">
                      {i === 0 ? (
                        <span className="inline-flex max-w-full items-center gap-1.5">
                          <button type="button" onClick={() => setDetail(r)} className="cursor-pointer truncate font-medium text-brand-600 hover:underline">
                            {formatAnswer(r.answers[c.key])}
                          </button>
                          {r.verified?.[c.key] && <VerifiedMark />}
                        </span>
                      ) : renderAnswer(id, c, r.answers[c.key], r.verified?.[c.key])}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(r.submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {data && data.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>{total} results · Page {data.page} of {data.totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" aria-hidden /> Prev</Button>
            <Button size="sm" variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4" aria-hidden /></Button>
          </div>
        </nav>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Response details"
        footer={<Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>}>
        {detail && (
          <>
            <p className="mb-3 text-xs text-slate-500">Submitted {formatDateTime(detail.submitted_at)}</p>
            <dl className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
              {fields.map((f) => (
                <div key={f.id}>
                  <dt className="text-xs font-medium text-slate-500">{f.label}</dt>
                  <dd className="whitespace-pre-wrap break-words text-slate-900">{renderAnswer(id, f, detail.answers[f.key], detail.verified?.[f.key])}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Modal>
    </div>
  );
}

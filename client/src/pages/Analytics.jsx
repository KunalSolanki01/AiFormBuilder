import { ArrowLeft, Inbox } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FormNotFound } from '../components/ui/FormNotFound.jsx';
import { Button, Card, EmptyState, ErrorBanner, Skeleton } from '../components/ui/index.jsx';
import { api } from '../services/api.js';
import { formatDate, formatDateTime } from '../utils/format.js';

const ACCENT = '#1f6b55';
const COLORS = ['#1f6b55', '#c58b2b', '#b4533a', '#4a6f8f', '#7d6a9a', '#8a8f5a', '#78726a', '#a33a3a'];
const SENTIMENT = [
  { key: 'positive', label: 'Positive', color: '#1f6b55' },
  { key: 'neutral', label: 'Neutral', color: '#a39d8d' },
  { key: 'negative', label: 'Negative', color: '#b4533a' },
];

function Metric({ label, value, hint }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <Card className="p-5">
      <h3 className="font-medium">{title}</h3>
      {subtitle && <p className="mb-3 text-xs text-slate-500">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-3'}>{children}</div>
    </Card>
  );
}

function DistributionChart({ stat }) {
  const data = stat.counts.map((c) => ({ name: c.label, count: c.count, percent: c.percent }));
  // Donut only where it reads well: few options, single-answer.
  const donut = !stat.multi && data.length <= 4 && stat.type !== 'select';
  const label = `${stat.label}: ${data.map((d) => `${d.name} ${d.count}`).join(', ')}`;

  if (donut) {
    return (
      <div role="img" aria-label={label} className="flex items-center gap-4">
        <ResponsiveContainer width="50%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <ul className="space-y-1.5 text-sm">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
              {d.name} <span className="text-slate-400">{d.count} · {d.percent}%</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={Math.max(140, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="#e2ddd1" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v, _n, p) => [`${v} (${p.payload.percent}%)`, 'Responses']} />
          <Bar dataKey="count" fill={ACCENT} radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FieldChart({ stat }) {
  if (stat.kind === 'distribution') {
    return <ChartCard title={stat.label} subtitle={`${stat.answered} answered`}><DistributionChart stat={stat} /></ChartCard>;
  }
  if (stat.kind === 'rating') {
    return (
      <ChartCard title={stat.label} subtitle={`Average ${stat.average ?? '—'} / ${stat.scale} · ${stat.answered} ratings`}>
        <div role="img" aria-label={`${stat.label} rating distribution`}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stat.counts}>
              <CartesianGrid vertical={false} stroke="#e2ddd1" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Responses']} />
              <Bar dataKey="count" fill="#c58b2b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    );
  }
  if (stat.kind === 'numeric') {
    return (
      <ChartCard title={stat.label} subtitle={`${stat.answered} answered`}>
        <dl className="grid grid-cols-4 gap-2 text-center">
          {[['Average', stat.average], ['Min', stat.min], ['Max', stat.max], ['Total', stat.sum]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 p-3">
              <dd className="text-lg font-semibold tabular-nums">{v ?? '—'}</dd>
              <dt className="text-xs text-slate-500">{k}</dt>
            </div>
          ))}
        </dl>
      </ChartCard>
    );
  }
  return null;
}

function AiSummary({ analysis, loading, onGenerate, disabled }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <h2 className="font-display text-xl font-semibold">Summary</h2>
        <Button size="sm" variant={analysis ? 'secondary' : 'primary'} onClick={onGenerate} loading={loading} disabled={disabled}>
          {analysis ? 'Write it again' : 'Write a summary'}
        </Button>
      </div>
      <div className="p-5" aria-live="polite">
        {loading && !analysis ? (
          <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
        ) : !analysis ? (
          <p className="text-sm text-slate-500">
            Get a short written summary, what stands out, sentiment and next steps. Personal details (names, emails, phones) are never sent to the AI.
          </p>
        ) : (
          <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
            <p className="text-slate-800">{analysis.summary}</p>

            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-500">Sentiment</h3>
              <div className="flex h-3 overflow-hidden rounded-sm bg-slate-100" role="img"
                aria-label={SENTIMENT.map((s) => `${s.label} ${analysis.sentiment?.[s.key] ?? 0}%`).join(', ')}>
                {SENTIMENT.map((s) => <div key={s.key} style={{ width: `${analysis.sentiment?.[s.key] ?? 0}%`, background: s.color }} />)}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {SENTIMENT.map((s) => (
                  <li key={s.key} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                    {s.label} <strong className="tabular-nums">{analysis.sentiment?.[s.key] ?? 0}%</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <section>
                <h3 className="mb-2 text-sm font-medium text-slate-500">What stands out</h3>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">{(analysis.insights ?? []).map((i) => <li key={i}>{i}</li>)}</ul>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-medium text-slate-500">What to do next</h3>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">{(analysis.recommendations ?? []).map((i) => <li key={i}>{i}</li>)}</ul>
              </section>
            </div>
            <p className="text-xs text-slate-400">
              Based on {analysis.response_count ?? '—'} responses · Generated {formatDateTime(analysis.generated_at)}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Analytics() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const load = useCallback(async () => {
    setError('');
    setNotFound(false);
    try {
      const res = await api.forms.analytics(id);
      setData(res);
      setAnalysis(res.latest_analysis);
    } catch (err) {
      setNotFound(err.status === 404);
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setAnalyzing(true);
    try {
      setAnalysis(await api.ai.analyze(id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  if (notFound) return <FormNotFound />;

  const chartFields = data?.fields.filter((f) => ['distribution', 'rating', 'numeric'].includes(f.kind)) ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link to={`/builder/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {data?.form.title ?? 'Back to builder'}
      </Link>
      <div className="mb-6 mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <Link to={`/builder/${id}/responses`}><Button variant="secondary"><Inbox className="h-4 w-4" aria-hidden /> View responses</Button></Link>
      </div>

      <ErrorBanner onRetry={load}>{error}</ErrorBanner>
      {!data && !error && (
        <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>
      )}

      {data && data.total === 0 && (
        <EmptyState icon={Inbox} title="No responses yet">Analytics appear once people start submitting your form.</EmptyState>
      )}

      {data && data.total > 0 && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Total responses" value={data.total} hint={data.last_submission_at ? `Last: ${formatDate(data.last_submission_at)}` : undefined} />
            <Metric label="Last 7 days" value={data.submissions_last_7_days} hint={`${data.submissions_today} today`} />
            <Metric label="Completion rate" value={`${data.completion_rate}%`} hint="Questions answered" />
            <Metric label={data.response_limit ? 'Spots remaining' : 'Limit'} value={data.response_limit ? data.remaining : 'None'} hint={data.response_limit ? `of ${data.response_limit}` : undefined} />
          </div>

          <AiSummary analysis={analysis} loading={analyzing} onGenerate={generate} />

          <ChartCard title="Responses over time" subtitle="Daily submissions">
            <div role="img" aria-label="Line chart of daily responses">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.timeline} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="#e2ddd1" />
                  <XAxis dataKey="date" tickFormatter={(d) => formatDate(`${d}T00:00:00`, { month: 'short', day: 'numeric' })} minTickGap={24} />
                  <YAxis allowDecimals={false} />
                  <Tooltip labelFormatter={(d) => formatDate(`${d}T00:00:00`)} formatter={(v) => [v, 'Responses']} />
                  <Line type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2} dot={data.timeline.length < 31} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {chartFields.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">{chartFields.map((s) => <FieldChart key={s.key} stat={s} />)}</div>
          )}
        </div>
      )}
    </div>
  );
}

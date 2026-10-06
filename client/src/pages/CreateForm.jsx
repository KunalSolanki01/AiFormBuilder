import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, ErrorBanner, Textarea } from '../components/ui/index.jsx';
import { api } from '../services/api.js';
import { EXAMPLE_PROMPTS } from '../utils/format.js';

const MAX = 2000;

export default function CreateForm() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState(null); // 'generating' | 'saving' | 'blank'
  const [error, setError] = useState('');
  const busy = phase !== null;
  const tooShort = prompt.trim().length < 10;

  const generate = async (e) => {
    e.preventDefault();
    if (tooShort || busy) return;
    setError('');
    setPhase('generating');
    try {
      const { form, warnings } = await api.ai.generateForm(prompt.trim());
      setPhase('saving');
      const saved = await api.forms.create({ ...form, response_limit: null });
      warnings.forEach((w) => toast.warning(w));
      navigate(`/builder/${saved.id}`);
    } catch (err) {
      setError(err.message);
      setPhase(null);
    }
  };

  const blank = async () => {
    setPhase('blank');
    setError('');
    try {
      const saved = await api.forms.create({ title: 'Untitled form', description: '', type: 'survey', fields: [], response_limit: null });
      navigate(`/builder/${saved.id}`);
    } catch (err) {
      setError(err.message);
      setPhase(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div>
        <h1 className="font-display text-4xl font-medium">What do you need to ask?</h1>
        <p className="mt-2 text-slate-600">Describe the form in plain words. You can change anything afterwards.</p>
      </div>

      <form onSubmit={generate} className="mt-8 rounded-lg border border-slate-300 bg-white p-4 focus-within:border-brand-600">
        <label htmlFor="prompt" className="sr-only">Describe your form</label>
        <Textarea
          id="prompt"
          rows={5}
          maxLength={MAX}
          value={prompt}
          disabled={busy}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Customer feedback form with name, email, a satisfaction rating and comments."
          className="resize-none border-0 bg-transparent text-base focus:ring-0"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400 tabular-nums">{prompt.length}/{MAX}</span>
          <Button type="submit" variant="ai" loading={phase === 'generating' || phase === 'saving'} disabled={tooShort || busy}>
            {phase === 'generating' ? 'Writing your form…' : phase === 'saving' ? 'Saving…' : 'Create form'}
          </Button>
        </div>
      </form>

      <div className="mt-4" aria-live="polite">
        <ErrorBanner onRetry={tooShort ? undefined : generate}>{error}</ErrorBanner>
      </div>

      <section className="mt-8" aria-label="Example prompts">
        <h2 className="mb-3 text-sm font-medium text-slate-500">Or start from an example</h2>
        <ul className="grid gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <li key={p}>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPrompt(p)}
                className="w-full cursor-pointer rounded-md border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:border-slate-400 disabled:opacity-50"
              >
                {p}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6">
        <Button variant="ghost" onClick={blank} disabled={busy} loading={phase === 'blank'}>
          Start with a blank form instead
        </Button>
      </div>
    </div>
  );
}

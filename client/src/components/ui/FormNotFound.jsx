import { Link } from 'react-router-dom';
import { Button } from './index.jsx';

/** Shown when a form's page is opened for a form that doesn't exist (deleted, or someone else's). */
export function FormNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-medium">This form doesn&apos;t exist</h1>
      <p className="mt-3 text-slate-600">It may have been deleted, or the link may belong to a different account.</p>
      <Link to="/dashboard" className="mt-6 inline-block"><Button>Back to your forms</Button></Link>
    </div>
  );
}

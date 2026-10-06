import { Link } from 'react-router-dom';

export const AUTHOR = {
  name: 'Kunal Solanki',
  github: 'https://github.com/KunalSolanki01',
  linkedin: 'https://www.linkedin.com/in/kunal-solanki-642220321',
};

const external = { target: '_blank', rel: 'noopener noreferrer' };
const linkClass = 'text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline';

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-lg font-semibold">AI Form Builder</p>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Describe a form, edit it, share it, and read the answers.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Built by <span className="font-medium text-slate-700">{AUTHOR.name}</span>
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Product</p>
            <p><a href="/#features" className={linkClass}>Features</a></p>
            <p><a href="/#how" className={linkClass}>How it works</a></p>
            <p><a href="/#roadmap" className={linkClass}>Coming next</a></p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Legal</p>
            <p><Link to="/privacy" className={linkClass}>Privacy Policy</Link></p>
            <p><Link to="/terms" className={linkClass}>Terms of Use</Link></p>
          </div>
          <div className="col-span-2 mt-2 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Find the developer</p>
            <p className="flex gap-5">
              <a href={AUTHOR.github} {...external} className={linkClass}>GitHub</a>
              <a href={AUTHOR.linkedin} {...external} className={linkClass}>LinkedIn</a>
            </p>
          </div>
        </nav>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} AI Form Builder · {AUTHOR.name}
      </div>
    </footer>
  );
}

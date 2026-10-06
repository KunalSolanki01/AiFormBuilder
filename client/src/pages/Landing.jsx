import { Link } from 'react-router-dom';
import { BlurHeading, Counter, FeatureCard, Reveal, TypedText } from '../components/reactbits/index.jsx';
import { Button } from '../components/ui/index.jsx';
import { AUTHOR, SiteFooter } from '../components/ui/SiteFooter.jsx';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { Logo } from '../layouts/AppLayout.jsx';
import { useAuth } from '../store/authStore.js';

const STEPS = [
  ['Describe', 'Write what you need the way you would to a colleague: who it is for and what to ask.'],
  ['Edit', 'Reword questions, change the answer type, drag things into order. Nothing is locked in.'],
  ['Publish', 'You get a plain link. Set a cap if spots are limited and it closes itself when full.'],
  ['Read the results', 'See every response, simple charts per question, and a short written summary.'],
];

// Facts about the product itself (the last one is stated in the Privacy Policy).
const STATS = [
  [12, '', 'question types'],
  [6, '', 'file formats'],
  [1, ' MB', 'per upload'],
  [0, '', 'tracking cookies'],
];

const PROMPT = 'Event registration for a college hackathon. Ask for name, email, phone, college, team size and preferred track.';

// Planned, not promised: these are the next-version ideas from the product plan.
const UPCOMING = [
  ['Conditional questions', 'Show or skip questions depending on earlier answers, so people only see what applies to them.'],
  ['Team collaboration', 'Invite teammates to build forms together and share the responses.'],
  ['Payments', 'Take payments or deposits as part of a registration form.'],
  ['Slack, Google Sheets and webhooks', 'Send new responses to the tools you already use.'],
  ['Email notifications', 'Get an email when a response arrives, and send respondents a confirmation.'],
  ['More templates', 'Start from ready-made forms for events, feedback, applications and more.'],
  ['Custom domains', 'Publish forms on your own web address instead of ours.'],
  ['Richer exports', 'Download responses in more formats, with more control over what is included.'],
];

const FEATURES = [
  ['A form from a sentence', 'Describe what you need and get a ready draft with sensible question types, required fields and answer options.'],
  ['A builder you control', 'Add, remove, duplicate and drag questions into order. Twelve question types, from short text to ratings and dates.'],
  ['File uploads', 'Let people attach a PDF, Word document or image (up to 1 MB). You choose which types each question accepts.'],
  ['Verified email addresses', 'Ask people to confirm their email by signing in with Google, so you know the address is theirs.'],
  ['Limits and closing', 'Cap the number of responses for events and sign-ups. The form closes itself when it is full, or whenever you close it.'],
  ['A link that just works', 'Every published form gets its own page that works on phones, with clear messages when it is closed or full.'],
  ['Responses in one place', 'Search, filter and sort what came in, open any response, and download uploaded files from a private link.'],
  ['Charts and a written summary', 'See how answers are distributed and how ratings average out, then get a short summary with what stands out.'],
  ['Careful with personal data', 'Names, emails, phone numbers and files are left out of the AI summary. Uploads are stored privately.'],
  ['Light and dark', 'Switch the whole app between light and dark. Your choice is remembered.'],
];

/** A static preview of what the generator produces — real markup, not a screenshot. */
function Specimen() {
  const row = 'flex items-baseline justify-between border-b border-slate-200 py-2.5 text-sm last:border-0';
  return (
    <div className="rounded-lg border border-slate-300 bg-white" aria-hidden>
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">You wrote</p>
        <div className="mt-1.5">
          <TypedText text={PROMPT} className="text-[15px] leading-snug text-slate-800" />
        </div>
      </div>
      <div className="px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">You get</p>
        <p className="font-display mt-1.5 text-xl font-semibold">College Hackathon Registration</p>
        <div className="mt-3">
          {[
            ['Full name', 'Short text'],
            ['Email address', 'Email'],
            ['Phone number', 'Phone'],
            ['College name', 'Short text'],
            ['Team size', 'Number'],
            ['Preferred track', 'Multiple choice'],
          ].map(([label, type]) => (
            <div key={label} className={row}>
              <span className="text-slate-900">{label}<span className="text-brand-600"> *</span></span>
              <span className="text-xs text-slate-500">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const user = useAuth((s) => s.user);
  const navLink = 'hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 md:block';
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          <a href="#features" className={navLink}>Features</a>
          <a href="#how" className={navLink}>How it works</a>
          <a href="#roadmap" className={navLink}>Coming next</a>
          <ThemeToggle />
          {user ? (
            <Link to="/dashboard"><Button>Your forms</Button></Link>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost">Log in</Button></Link>
              <Link to="/register"><Button>Sign up</Button></Link>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 md:grid-cols-[1.1fr_1fr] md:pt-20">
          <div>
            <BlurHeading
              as="h1"
              text="Say what you need to ask. Get the form."
              className="font-display text-5xl font-medium leading-[1.05] text-slate-900 sm:text-6xl"
            />
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
              Describe your form in a sentence or two. You get a working draft in a few seconds, ready to edit,
              share and collect answers with.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to={user ? '/create' : '/register'}><Button size="lg">Make your first form</Button></Link>
              {!user && <Link to="/login" className="text-sm font-medium text-slate-700 underline underline-offset-4">I already have an account</Link>}
            </div>
          </div>
          <Specimen />
        </section>

        <section aria-label="At a glance" className="border-t border-slate-200">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 md:grid-cols-4">
            {STATS.map(([value, suffix, label], i) => (
              <Reveal key={label} delay={i * 0.08} distance={16}
                className="flex flex-col-reverse gap-1 border-slate-200 px-5 py-8 odd:border-r md:border-r md:last:border-r-0 md:first:pl-5">
                <dt className="text-sm text-slate-500">{label}</dt>
                <dd className="font-display text-5xl font-medium text-slate-900">
                  <Counter to={value} />{suffix}
                </dd>
              </Reveal>
            ))}
          </dl>
        </section>

        <section id="features" className="scroll-mt-4 border-t border-slate-200" aria-labelledby="features-title">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 id="features-title" className="font-display text-3xl font-medium">What you get</h2>
            <p className="mt-2 max-w-xl text-slate-600">Everything between &ldquo;I need a form&rdquo; and &ldquo;I understand the answers&rdquo;.</p>
            <dl className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {FEATURES.map(([title, text], i) => (
                <Reveal key={title} delay={(i % 2) * 0.1} className="border-t border-slate-200 pt-4">
                  <dt className="font-semibold text-slate-900">{title}</dt>
                  <dd className="mt-1 leading-relaxed text-slate-600">{text}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        <section id="how" className="scroll-mt-4 border-t border-slate-200" aria-labelledby="how-title">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 id="how-title" className="font-display text-3xl font-medium">How it works</h2>
            <ol className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {STEPS.map(([title, text], i) => (
                <Reveal as="li" key={title} delay={(i % 2) * 0.1} className="flex gap-5">
                  <span className="font-display w-8 shrink-0 text-3xl leading-none text-brand-600">{i + 1}</span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1 text-slate-600">{text}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
            <div className="mt-12">
              <Link to={user ? '/create' : '/register'}><Button size="lg">Try it with your own form</Button></Link>
            </div>
          </div>
        </section>

        <section id="roadmap" className="scroll-mt-4 border-t border-slate-200" aria-labelledby="roadmap-title">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
              <div>
                <h2 id="roadmap-title" className="font-display text-3xl font-medium">Coming next</h2>
                <p className="mt-3 max-w-lg leading-relaxed text-slate-600">
                  These are planned, not promised, and there are no dates. What gets built first depends on what
                  people ask for.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="mr-1 text-sm font-medium text-slate-900">Missing something you need?</p>
                <a
                  href={AUTHOR.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                >
                  Suggest a feature
                </a>
                <a
                  href={AUTHOR.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100"
                >
                  Follow the progress
                </a>
              </div>
            </div>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {UPCOMING.map(([title, text], i) => (
                <Reveal as="li" key={title} delay={(i % 4) * 0.08} distance={24} className="h-full">
                  <FeatureCard>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-2xl leading-none text-brand-600">{String(i + 1).padStart(2, '0')}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Planned</span>
                    </div>
                    <h3 className="mt-6 font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
                  </FeatureCard>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

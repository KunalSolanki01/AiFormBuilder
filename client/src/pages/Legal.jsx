import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter, AUTHOR } from '../components/ui/SiteFooter.jsx';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { Logo } from '../layouts/AppLayout.jsx';

const UPDATED = 'October 6, 2026';

function Page({ title, intro, children, other }) {
  useEffect(() => {
    document.title = `${title} · AI Form Builder`;
    window.scrollTo(0, 0);
    return () => { document.title = 'AI Form Builder'; };
  }, [title]);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
        </Link>
        <h1 className="font-display mt-6 text-4xl font-medium sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated {UPDATED}</p>
        <p className="mt-6 text-lg leading-relaxed text-slate-700">{intro}</p>
        <div className="mt-10 space-y-10">{children}</div>
        <p className="mt-14 border-t border-slate-200 pt-6 text-sm text-slate-600">
          Also read our <Link to={other.to} className="font-medium text-brand-600 underline underline-offset-4">{other.label}</Link>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

const Section = ({ title, children }) => (
  <section>
    <h2 className="font-display text-2xl font-medium">{title}</h2>
    <div className="mt-3 space-y-3 leading-relaxed text-slate-700">{children}</div>
  </section>
);

const List = ({ items }) => (
  <ul className="list-disc space-y-1.5 pl-5">
    {items.map((item) => <li key={item}>{item}</li>)}
  </ul>
);

const Contact = () => (
  <p>
    You can reach the developer, {AUTHOR.name}, through{' '}
    <a href={AUTHOR.github} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 underline underline-offset-4">GitHub</a>{' '}
    or{' '}
    <a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 underline underline-offset-4">LinkedIn</a>.
  </p>
);

export function Privacy() {
  return (
    <Page
      title="Privacy Policy"
      intro="This explains what AI Form Builder collects, why, who it is shared with, and the choices you have. We try to collect only what the service needs to work."
      other={{ to: '/terms', label: 'Terms of Use' }}
    >
      <Section title="Who this applies to">
        <p>There are two groups of people, and this policy covers both:</p>
        <List items={[
          'Form owners: people who create an account and build forms.',
          'Respondents: people who fill in a form that an owner has published.',
        ]} />
        <p>
          When you answer someone&apos;s form, the form owner decides what is asked and is responsible for how they
          use your answers. AI Form Builder stores and processes those answers on the owner&apos;s behalf.
        </p>
      </Section>

      <Section title="What we collect">
        <p><strong>From form owners</strong></p>
        <List items={[
          'Account details: your name and email address, and a password that is handled by our authentication provider. We never see or store your password in readable form.',
          'The forms you create: titles, descriptions, questions and settings, and the descriptions you type into the AI form generator.',
          'The responses and uploaded files your forms receive.',
        ]} />
        <p><strong>From respondents</strong></p>
        <List items={[
          'The answers you submit, including any file you upload (PDF, Word or image, up to 1 MB).',
          'If the form asks you to verify your email with Google: your Google email address. We receive nothing else from your Google account.',
          'Your browser type (the user-agent text) and the time of submission, saved with your response.',
        ]} />
        <p><strong>Technical data</strong></p>
        <p>
          Your IP address is used briefly to limit abuse, such as too many sign-in attempts or uploads. It is not
          saved with your responses or account.
        </p>
      </Section>

      <Section title="How we use it">
        <List items={[
          'To run the service: sign you in, save forms, collect and show responses, and make charts.',
          'To generate forms and summaries with AI, as described below.',
          'To keep the service safe: rate limiting, rejecting unsafe files, and preventing duplicate submissions.',
        ]} />
        <p>We do not sell your data and we do not use it for advertising.</p>
      </Section>

      <Section title="AI processing">
        <p>
          AI features are provided by Groq. We send it only what is needed for the feature you use:
        </p>
        <List items={[
          'Form generation: the description you type.',
          'Response summaries: your form\'s title, question labels, answer statistics and a sample of answers. Names, emails, phone numbers, address-style fields and uploaded files are left out. Email addresses, phone numbers and links that appear inside free-text answers are replaced with placeholders first.',
        ]} />
        <p>
          Groq processes that content under its own terms and privacy policy. AI output can contain mistakes, so
          please review it before relying on it.
        </p>
      </Section>

      <Section title="Who else handles your data">
        <List items={[
          'Supabase: hosts our database, sign-in system and file storage.',
          'Groq: provides the AI features described above.',
          'Google: only on forms that ask for email verification. Google\'s sign-in button loads from Google and is subject to Google\'s privacy policy.',
        ]} />
        <p>We share data with them only to provide the service, or if the law requires it.</p>
      </Section>

      <Section title="Files you upload">
        <p>
          Uploaded files are kept in private storage. They can only be opened by the owner of the form they were
          sent to, through a link that expires after about a minute. Files are not public and are never sent to the
          AI.
        </p>
      </Section>

      <Section title="Cookies and local storage">
        <p>
          We do not use advertising or tracking cookies. Your browser&apos;s local storage keeps your sign-in session
          and your light or dark theme choice, so the app can remember them. You can clear this at any time in your
          browser settings; you would then need to sign in again.
        </p>
      </Section>

      <Section title="How long we keep data">
        <List items={[
          'Forms, responses and uploaded files are kept until the owner deletes them. Deleting a form permanently removes its responses and files.',
          'Account details are kept while your account exists. To have your account removed, contact us.',
        ]} />
      </Section>

      <Section title="Your choices">
        <p>
          You can see, edit and delete your forms and responses in the app. To ask about, correct or delete personal
          data we hold about you, or to ask us to remove a response you submitted, contact us. If you are a
          respondent, you may also contact the form owner, who controls that data.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Data is sent over encrypted connections. Access to forms and responses is limited to the owner, uploads are
          checked and stored privately, and we limit how fast requests can be made. No online service can promise
          perfect security, so please avoid putting highly sensitive information in forms.
        </p>
      </Section>

      <Section title="Children">
        <p>The service is not aimed at children under 13, and we do not knowingly collect their data.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>If we change this policy we will update the date at the top. Larger changes will be announced in the app.</p>
      </Section>

      <Section title="Contact">
        <Contact />
      </Section>
    </Page>
  );
}

export function Terms() {
  return (
    <Page
      title="Terms of Use"
      intro="By creating an account or using a form built with AI Form Builder, you agree to these terms. If you do not agree, please do not use the service."
      other={{ to: '/privacy', label: 'Privacy Policy' }}
    >
      <Section title="The service">
        <p>
          AI Form Builder lets you create forms (including with the help of AI), share them through a public link,
          collect responses and files, and view basic analytics and AI-written summaries. We may add, change or
          remove features over time.
        </p>
      </Section>

      <Section title="Your account">
        <List items={[
          'Give accurate details and keep your password private. You are responsible for activity under your account.',
          'You must be old enough to form a binding agreement where you live, and at least 13.',
          'Tell us if you think someone else has accessed your account.',
        ]} />
      </Section>

      <Section title="What you may and may not do">
        <p>You agree not to use the service to:</p>
        <List items={[
          'Break the law, or collect information in a way that breaks privacy or data-protection rules.',
          'Collect passwords, payment card numbers, government ID numbers, or other highly sensitive data.',
          'Send spam, run scams or phishing, or mislead people about who is asking for their information.',
          'Upload malware, or files you do not have the right to share.',
          'Harass, threaten or discriminate against others, or share illegal or abusive content.',
          'Try to break, overload or bypass the limits of the service, or access data that is not yours.',
        ]} />
        <p>We may remove content or suspend accounts that break these rules.</p>
      </Section>

      <Section title="Your forms and the data you collect">
        <p>
          You own your forms and the content you put in them. If you collect responses from other people, you are
          responsible for doing so lawfully: telling respondents what you will do with their answers, getting any
          consent you need, and handling their data with care. Respondents&apos; answers belong to you and them, not
          to us.
        </p>
      </Section>

      <Section title="Responses and file uploads">
        <p>
          Respondents can upload PDF, Word (.doc, .docx) and image (.jpg, .jpeg, .png) files up to 1 MB each. Files
          are checked, but you should still treat files from the public with care and avoid opening anything you do
          not trust.
        </p>
      </Section>

      <Section title="AI features">
        <p>
          Forms and summaries produced by AI may be incomplete or wrong. Check them before you publish a form or
          make decisions from a summary. You are responsible for how you use AI output.
        </p>
      </Section>

      <Section title="Availability and limits">
        <p>
          We aim to keep the service running but do not promise it will always be available or error-free. We may
          apply limits, such as how many AI requests or uploads can be made in a period, to keep the service fair
          and stable. Keep your own copy of anything important.
        </p>
      </Section>

      <Section title="Ending your use">
        <p>
          You can stop using the service and delete your forms at any time. We may suspend or end access if you break
          these terms or put the service or other people at risk. Deleting a form permanently removes its responses
          and files.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind
          to the fullest extent the law allows. We do not guarantee that it will meet your needs, that data will never
          be lost, or that AI output will be accurate.
        </p>
      </Section>

      <Section title="Limits on liability">
        <p>
          To the fullest extent the law allows, we are not liable for indirect or consequential losses, lost data,
          lost profits, or issues caused by content you or your respondents submit. Nothing in these terms limits
          liability that cannot be limited by law.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          We may update these terms. The date at the top shows the latest version, and continuing to use the service
          after a change means you accept it.
        </p>
      </Section>

      <Section title="Contact">
        <Contact />
      </Section>
    </Page>
  );
}

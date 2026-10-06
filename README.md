# AI Form Builder — V1

Describe a form in plain English → Groq generates a validated schema → edit in the visual builder → publish a public link → collect responses → analytics + AI summary.

Stack: React + Vite + Tailwind 4 + Zustand + dnd-kit + Recharts · Express 5 · Supabase (Postgres + Auth) · Groq · Zod.
Full requirements: [docs/PRD.md](docs/PRD.md).

## Layout

```
shared/    Field types, Zod form schema, answer validation, AI-output normalizer (used by client AND server)
server/    Express API  (controllers → services → Supabase/Groq)
client/    React app
supabase/  SQL migrations (tables, RLS, RPCs)
```

The same `shared/` validation runs in the browser and on the server, so the backend stays authoritative while the UI gives instant feedback.

## Setup

1. **Supabase** — create a project, then run the migrations **in order** in the SQL editor (or `supabase db push`):
   [20261006000000_v1_init.sql](supabase/migrations/20261006000000_v1_init.sql) (tables, RLS, functions) and
   [20261006010000_file_uploads.sql](supabase/migrations/20261006010000_file_uploads.sql) (file field type + private `form-uploads` bucket), and
   [20261006020000_one_response_per_email.sql](supabase/migrations/20261006020000_one_response_per_email.sql) (one response per verified email).
   For quick local testing, disable *Authentication → Providers → Email → Confirm email*; otherwise users must confirm before logging in (the UI handles both).
2. **Groq** — create a key at <https://console.groq.com>.
3. **Env** — copy `.env.example` to `server/.env` and fill in the values.
4. **Run**

```bash
npm install
npm run dev        # API on :4000, client on :5173 (Vite proxies /api)
npm test           # shared + server + client suites
npm run build      # production client build → client/dist
```

## Key design decisions

| Concern | Approach |
|---|---|
| Groq key safety | Called only from `server/`; never in a `VITE_*` variable. Provider errors are mapped to generic messages. |
| AI output | JSON mode → `normalizeAiForm` (alias mapping, unsupported fields dropped with warnings, HTML stripped, keys deduped) → Zod. One automatic retry; safe fallback error. |
| Authorization | API uses the service role, so **every query is scoped by `user_id`** in the service layer; other users' forms return 404. RLS is enabled as defence in depth. |
| Response limit | Enforced in the `submit_response` Postgres function: row lock → status/limit check → insert → counter, in one transaction (no overselling under concurrency). |
| Duplicate submissions | Client sends a per-visit `submission_id` (unique) — retries return the original response instead of double counting. |
| Editing live forms | Field ids are stable; answers reference ids, so renames/reorders are safe. Types of fields that already have responses are locked. |
| AI summary privacy | Email/phone fields and name/address-like fields are dropped; emails, phones and URLs inside free text are redacted; sample capped. |

## React Bits (landing page animations)

The landing page uses five components from [React Bits](https://reactbits.dev): `BlurText` (headline), `TextType` (typed example prompt), `CountUp` (stats), `AnimatedContent` (scroll reveals) and `SpotlightCard` (the "Coming next" cards). They are copied into `client/src/components/reactbits/` (React Bits is a copy-in library, not an npm package) and need `gsap` and `motion`.

- `client/src/components/reactbits/index.jsx` wraps them and renders plain static content when the visitor has **reduce motion** turned on.
- Small local changes: `BlurText` and `AnimatedContent` accept an `as` prop so they can render a heading / list item; `SpotlightCard` takes its border/background/padding from `className` (the original is dark-only).
- License: MIT + Commons Clause — free to use in an app or product, but the components themselves can't be resold or redistributed. Keep `reactbits/LICENSE.md`.
- Add more with `https://reactbits.dev/r/<Name>-JS-TW.json` (JavaScript + Tailwind variant).

## File uploads

A **File upload** question lets respondents attach one file.

- **Allowed:** `pdf`, `doc`, `docx`, `jpg`, `jpeg`, `png` — **max 1 MB**. The form owner can narrow the list per question (PDF / Word / Images). The constants live in `shared/src/fieldTypes.js` (`FILE_UPLOAD`), so the browser, API and AI prompt agree.
- **Flow:** the browser checks type/size, then sends the raw bytes to `POST /api/public/forms/:slug/uploads`. The API re-checks extension, size and the file's **magic bytes** (a renamed `.exe` is rejected), stores it privately in Supabase Storage under `<formId>/<random-uuid>.<ext>`, and returns `{ path, name, size }`. That reference is what gets submitted with the answers.
- **On submit** the API verifies each file reference points into this form's folder and still exists.
- **Viewing:** owners get a 60-second signed URL from `GET /api/forms/:id/files` (ownership checked). The bucket is private; there are no storage policies for browser clients.
- **Not sent to the AI:** file fields are excluded from AI summaries.
- Deleting a form deletes its stored files.
- **Limitation:** a file uploaded but never submitted (respondent abandons the form) stays in storage until its form is deleted. Add a scheduled cleanup if that matters at your scale.

## Verified email (Sign in with Google)

An **Email** question can require the respondent to confirm the address by signing in with Google. The quickest way: in the builder tick **Verify respondents' email with Google** under the form's settings (it adds a required Email question if the form has none). You can also set it per question (question settings → *Verify with Google sign-in*). One verified email question per form.

- **Flow:** the respondent clicks Google's "Continue with Google" button → the browser gets a signed ID token → `POST /api/public/forms/:slug/verify-email` checks its signature, issuer, audience (your client id), expiry and `email_verified` using Google's public keys, then returns the lowercase email plus a **server-signed proof** (HMAC, valid 30 min, bound to that form, question and address).
- **On submit** the API requires a valid proof matching the typed address; otherwise it returns `EMAIL_NOT_VERIFIED`. Verified responses show a ✓ next to the email on the Responses page.
- **One response per verified email** (builder → tick it under the verification switch, or per question): each verified Google address can submit the form once.
  - Checked twice: right after sign-in (so people aren't told after filling in a long form) and again, atomically, inside the `submit_response` database function (form row lock + unique index on `responses(form_id, dedupe_key)`), so simultaneous submissions can't both get in.
  - Addresses are compared case-insensitively. Earlier Google-verified responses (saved before the setting was switched on) count too; responses with a merely *typed* email don't.
  - Needs migration `20261006020000_one_response_per_email.sql`. Limit: one person with several Google accounts can still respond once per account.
- **No Google accounts are created** in Supabase and no Google secret is stored — only the public `GOOGLE_CLIENT_ID`.
- **Setup:** Google Cloud Console → *APIs & Services → Credentials → Create credentials → OAuth client ID → Web application*. Under **Authorized JavaScript origins** add your site origins (e.g. `http://localhost:5173`, `http://localhost:5180`, and your production URL). Put the Client ID in `server/.env` as `GOOGLE_CLIENT_ID=…` and restart the API. (You may be asked to configure the OAuth consent screen first; "External" + your own email is enough for testing.)
- Publishing a form that requires verification is refused until `GOOGLE_CLIENT_ID` is set.
- Only Google accounts can verify. Other providers (e.g. Outlook, Yahoo) would need a different method.

## API

`/api/auth/{register,login,refresh,logout,me}` · `/api/forms` (CRUD, `/:id/publish`, `/:id/close`, `/:id/responses[/:rid]`, `/:id/analytics`) · `/api/ai/{generate-form,analyze-responses}` · `/api/public/forms/:slug[/responses|/uploads|/verify-email]` · `/api/forms/:id/files`.
All responses are `{ success, data }` or `{ success: false, error: { code, message, details? } }`.

## Deployment

- **Client** (Vercel): root `client`, build `npm run build`, output `dist`. Set `VITE_API_URL` to the API origin and add an SPA rewrite of all paths to `/index.html`.
- **API** (Render/Railway): start `npm start` (root workspaces) with the server env vars; set `CLIENT_URL` to the Vercel origin(s) for CORS.

## Known V1 limitations

- Analytics/AI load responses in memory (capped at 20k per form); move to SQL aggregation if forms get larger.
- Rate limiting is per-process (in-memory); use a shared store if you scale to multiple instances.
- Not yet exercised against a live Supabase project — run the migration and walk the flow once (sign up → generate → publish → submit → summary).

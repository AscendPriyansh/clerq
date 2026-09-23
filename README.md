# Clerq

Receipt ingestion and bank reconciliation for agencies and bookkeepers. Built with Next.js App Router, TypeScript, Prisma **6**, Supabase Auth/Storage/PostgreSQL, Groq, Resend and the requested UI/export libraries.

## Run locally

Use Node.js 22 or newer. Keep credentials in `.env.local` (ignored by Git); `.env.local.example` lists the available settings.

```sh
npm ci
npm run db:generate
npm run db:push
npm run storage:setup
npm run dev
```

In a separate terminal, start the durable background worker:

```sh
npm run worker
```

Register or sign in, create an organisation, upload receipts and import a bank CSV. Onboarding works before Resend is configured. The worker parses queued receipts and reconciles imports. The Reconcile page can also run the matcher on demand. Review unreadable receipts manually in the Receipts vault, then confirm suggestions or select two rows for a manual match. Download a monthly tax pack from Overview.

## Environment and services

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) configure browser/SSR authentication.
- `DATABASE_URL` is the Supabase pooled PostgreSQL URI. `DIRECT_URL` is the direct or session-pooler URI for schema operations. Both require the URL-encoded database password.
- `SUPABASE_SERVICE_ROLE_KEY` enables private receipt storage on the server. It is never exposed to the browser.
- `GROQ_API_KEY` enables structured extraction. `GROQ_TEXT_MODEL` defaults to `openai/gpt-oss-120b`, verified in the configured Groq account's model list. Both Llama model IDs in the original prompt are unavailable; images and scanned PDFs use Tesseract OCR followed by Groq text extraction. Set `GROQ_VISION_MODEL` only to a currently supported model if desired. Tesseract downloads its English language data on first use.
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` and `INBOUND_EMAIL_DOMAIN` enable email receipts. They can be supplied later without changing the integration code.
- `NEXT_PUBLIC_APP_URL` is the application's public URL. Configure the matching `/auth/callback` URL in Supabase Auth. Google OAuth is hidden unless NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true; enable the provider in Supabase first. Supabase Auth sends account confirmation and magic-link emails.

The application creates no paid subscriptions and does not configure billing. Usage remains subject to the configured providers' free-tier limits.

## Resend setup after replacing the key

1. Enable receiving for your assigned Resend domain or a custom receiving subdomain; set it as `INBOUND_EMAIL_DOMAIN`.
2. Register the deployed `https://your-app/api/webhooks/resend` endpoint for `email.received` and save its signing secret in `RESEND_WEBHOOK_SECRET`.
3. Restart the app and worker after environment changes. Use **Settings → Activate email forwarding** to assign the current organisation's address.
4. If earlier email jobs exhausted their retries, run `npm run jobs:retry` and keep the worker running.

The handler validates the raw body against the Svix headers, persists an idempotent database job and returns promptly. Attachment bytes are fetched from the authenticated Resend API, validated and saved privately. No unauthenticated test mode exists. Missing webhook configuration returns a structured HTTP 503; an invalid signature returns 401.

## Processing and matching behaviour

- Direct upload accepts PDF, PNG, JPEG and WebP files up to 10 MB and returns **202** once the file and parse job are persisted. The vault refreshes during processing. Vercel uses Queues; local development uses npm run worker. Browser uploads go directly to private storage before server-side validation, bypassing Vercel's request-size limit.
- Jobs retry five times with backoff. Interrupted jobs become eligible again after ten minutes. Failed extraction preserves the original file and flags the receipt for manual review. Missing dates/amounts are never invented.
- CSV imports accept up to 10,000 rows / 4 MB. Select date order, currency and the sign convention explicitly. Identical transactions within one statement remain separate; repeating the statement is idempotent. Without a bank-provided transaction ID, identical rows in independently exported statements cannot always be distinguished.
- Amounts are decimal, and currency must match. Exact matches require equal amounts, dates within three days, vendor score >= 0.95, extraction confidence >= 0.85 and a unique candidate on both sides. Ambiguous pairs require review. Fuzzy suggestions use an amount difference <= 0.02, dates within five days and vendor score > 0.75.
- Confirmations and automatic matches update all three records atomically under an organisation lock. Database constraints prevent duplicate and cross-organisation reconciliation links. Dismissed pairs remain dismissed on later runs.
- ZIP exports use the **reconciliation month**, with an exclusive next-month boundary. The CSV references unique original files; images keep their image extensions rather than being mislabelled as PDFs. Formula-like CSV text is escaped. Requests exceeding 200 receipts or 100 MB return a clear error rather than a partial archive.
- Receipt and transaction lists show the latest 500 rows. The reconciliation workbench includes all debit transactions/receipts and paginates them locally.

## Validation

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:integration
```

`test:integration` requires a completed build and configured Supabase credentials. It starts a temporary production server on port 3002, creates disposable test identities/data, tests uploads, matching, signed Resend fixtures and exports, then removes its fixtures. It sends no email. Run `node scripts/test-onboarding.mjs` against a dev server on port 3001 for the full onboarding Server Action check. `node --conditions=react-server --import tsx scripts/test-extraction.ts` exercises Groq using a synthetic receipt.

See BUILD_STATUS.md for checks actually completed and outstanding live service verification. `node scripts/check-services.mjs` performs read-only credential checks without printing keys.

## Seed data

```sh
npx prisma db seed
```

This creates a demo organisation with 10 bank transactions and 8 PDF receipts: five exact pairs and three unlinked receipts. Existing demo records are preserved. Set `SEED_USER_ID` to your Supabase Auth UUID to attach the demo organisation to your account. Otherwise a disposable `clerq-demo@example.test` Auth account is created; set `SEED_PASSWORD` before first seeding if you want to log in as that account. The private bucket must exist first.

## Database and deployment

All application database access goes through Prisma 6. `db:push` is intended for development schema setup and enables row-level security on the application tables; it grants no public Data API policies. Prisma uses the server's database connection and membership checks. Use reviewed Prisma migrations for production schema changes.

On Vercel, vercel.json configures a private Queues consumer and a daily recovery cron. The queue invokes saved jobs automatically, including extraction and reconciliation follow-ups. Set CRON_SECRET to a random value of at least 32 characters in Production. Hobby supports one daily recovery run; normal processing is triggered immediately by Queues. Enable Fluid compute and Node.js 22 or newer. The build regenerates Prisma 6. Keep receipts-vault private. Self-hosted/local installations still need npm run worker.

After updating environment variables, redeploy. Run node scripts/check-deployment.mjs https://clerq-zeta.vercel.app to check public access controls and the signing secret without sending email. Vercel Queues is currently beta; monitor the queue and function logs during initial use.

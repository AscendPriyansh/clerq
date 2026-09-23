# Clerq build status

The build follows the phase sequence in the supplied prompt. The user authorised implementing Resend with fixture tests while replacing its credentials later; live email verification is therefore deferred.

| Phase | Implementation | Verification |
| --- | --- | --- |
| 1 — Foundation | Schema, SSR clients, access proxy, environment template | Live Supabase db push, Prisma generation and row-level security setup passed |
| 2 — Auth and onboarding | Auth forms, callback, transactional onboarding, dashboard navigation | Live password sign-in, onboarding Server Action, owner membership, dashboard and tenant denial passed; temporary fixtures cleaned up |
| 3 — Ingestion and AI | Resend signed webhook, durable queue/worker, private storage, uploads, PDF/OCR/Groq extraction, review and retry | Private storage/uploads and worker passed live checks; PDF/Groq and image OCR/Groq passed; signed webhook HTTP fixtures/replay rejection passed; live Resend delivery deferred |
| 4 — CSV import | Mapping, date/sign options, exact decimal values, duplicate imports, row errors and queued reconciliation | Unit tests and live decimal import/duplicate reimport passed |
| 5 — Reconciliation | Exact/fuzzy matching, ambiguity review, atomic confirmations, dismissals and manual matches | Unit tests and live concurrent exact matching, fuzzy confirmation, manual override and tenant rejection passed |
| 6 — Cockpit and export | Split-pane tables, URL filters, selection, receipt review, tax-pack ZIP/CSV | Production build passed; live ZIP export verified all three match types, CSV references, original bytes and tenant isolation |

## Foundation decisions

- Prisma remains on version 6, as confirmed by the user's latest instruction. All application database access uses Prisma. CLI configuration and the seed command are in `prisma.config.ts`.
- `User.id` is the Supabase Auth UUID. Auth/onboarding must synchronise the application user before creating membership.
- Receipt extraction fields are nullable during processing; missing amounts and dates must never be invented.
- Composite foreign keys prevent a reconciliation from linking records across organisations. Each receipt and bank transaction can appear in at most one reconciliation.
- Transaction amounts use decimal storage. Notes support missing-receipt and unlinked-invoice flags; an optional organisation-scoped import key supports repeat-import detection.
- `rawFileUrl` stores a private Storage object path. The original-file route verifies membership before streaming the file with private cache headers.
- The route guard uses `proxy.ts`, the current Next.js 16 convention, and its default Node.js runtime for Prisma compatibility.
- Protected APIs return structured JSON errors instead of HTML redirects. Browser requests redirect to login/onboarding. API handlers and Server Actions must also enforce membership for their own target organisation with `requireMembership`.
- Later phases need database credentials, a storage server credential, Groq configuration and webhook configuration. The publishable key only enables client-side Supabase access.
- An organisation can be created before email is configured. Its alias remains null, and Settings can activate forwarding once the receiving domain and Resend credentials are available.
- Upload endpoints acknowledge persisted receipts with HTTP 202. Run the database-backed worker separately to extract and reconcile them. This replaces unsafe fire-and-forget work inside HTTP handlers.
- Both requested Llama models are unavailable. Groq's authenticated model listing includes `openai/gpt-oss-120b`, now the configurable text default. Images/scanned PDFs use Tesseract OCR plus Groq; `GROQ_VISION_MODEL` optionally selects a current model.
- Exact matches require extraction confidence >= 0.85 and a unique candidate on both sides. Suggested matches require review; cross-currency pairs are rejected.
- Exports retain original PDF/image formats, use unique filenames and escape spreadsheet formulas. Each export is capped at 200 receipts / 100 MB and explicitly rejects larger requests.

## Email provider update

Resend replaces Postmark at the user's request. `/api/webhooks/resend` verifies the raw body with `RESEND_WEBHOOK_SECRET`, queues `email.received` events, and the worker retrieves attachments through the Resend receiving API using `RESEND_API_KEY`. The webhook signing secret is separate from the API key. `INBOUND_EMAIL_DOMAIN` must be the actual domain enabled for receiving in Resend. Envelope recipients are preferred over display headers when routing to an organisation.

## Completed verification

- 31 Jest tests passed, covering match rules, ambiguity, currency isolation, decimal tolerance, CSV mapping/dates/duplicates, MIME validation, bounded request bodies and signed Resend fixtures.
- TypeScript and ESLint passed.
- Production build passed for all dashboard pages and API routes.
- npm dependency audit reported zero vulnerabilities after pinning the compatible TanStack Table major and patching Prisma's configuration dependency.
- Live Supabase password sign-in, onboarding Server Action, owner membership and dashboard routing passed.
- Live private file upload/deduplication, CSV import/reimport, concurrent matching and cross-tenant rejection passed.
- Live Groq extraction passed on a synthetic text PDF and a rasterised image through Tesseract OCR.
- Durable worker parsing and its atomic reconciliation job hand-off passed.
- Signed Resend HTTP fixtures, tampered signature rejection and repeated-delivery deduplication passed. Real Resend attachment fetching awaits replacement credentials.
- Live authenticated ZIP export verified exact, fuzzy-confirmed and manual-override records, correct CSV file references and unchanged original PDF bytes. Another tenant's export was denied.
- All temporary integration users, organisations, files and jobs were cleaned up.

## Vercel deployment update — 23 September 2026

- The user deployed the initial app at https://clerq-zeta.vercel.app on Hobby. Login and unauthenticated access controls passed live checks.
- The replacement Resend key works. The registered webhook is enabled for `email.received` at the correct route; its signing secret matches `.env.local`. The configured receiving domain has MX records.
- The current live deployment still returns 503 for the webhook, indicating its signing secret is not available to that deployment. Save `RESEND_WEBHOOK_SECRET` for Production and redeploy.
- Added Vercel Queues dispatch and a private consumer for saved database jobs. Follow-up reconciliation jobs are dispatched after commit, retries preserve database state, and a daily protected cron recovers interrupted or unpublished jobs. Local/self-hosted development retains the separate worker.
- Added direct signed uploads into private Supabase Storage, followed by authenticated tenant/user-scoped finalisation and file-byte validation. Original receipt and ZIP downloads stream their response. CSV uploads are limited to 4 MB to fit Vercel request limits.
- Google sign-in remains deferred and its button is hidden unless explicitly enabled.
- Production build, lint and 40 unit tests passed. Expanded live integration checks passed: >5 MB signed upload, cross-tenant denial, exact original-file streaming, durable extraction, concurrent matching, fuzzy/manual confirmation, signed webhook deduplication and streamed ZIP export. Disposable fixtures were removed.
- A random `CRON_SECRET` was generated in the ignored `.env.local`; copy it to Vercel Production for daily recovery. No secret is committed.
- Actual Vercel queue execution, new large-file routes and Resend signatures must be checked after publishing these changes. Real forwarded email delivery and inbox-based sign-in links still require end-to-end verification.

## Earlier service checks — 22 September 2026 (superseded above where noted)

- Supabase database connection: passed; schema created successfully.
- Supabase Auth settings: HTTP 200; email provider enabled, Google provider disabled.
- Resend domains API: HTTP 401 with the configured API key; credential needs correction.
- `RESEND_WEBHOOK_SECRET`: empty at last check.
- `INBOUND_EMAIL_DOMAIN`: absent at last check; needed only for email forwarding.
- HTTP smoke checks: login/register returned 200; dashboard/onboarding redirected unauthenticated requests to login; protected API prefixes returned structured 401 errors; callback without code returned structured 400.
- Magic-link delivery, Google OAuth and registration confirmation have not been exercised end to end. Authenticated onboarding passed with an admin-created disposable test identity. No email was sent by automated checks.

# Umbral Hub

Private information hub for the Umbral group, written in Portuguese (Portugal).

## Functionality

Alojamentos: create, consult, update and delete property records with general information, room types and inventory, rate plans, operators and commission terms, 43 predefined amenities and custom amenities, and operational policies. Corporates: create and edit company identity, contacts and billing data, agreement dates and terms, discount and promotional code, and select linked registered properties individually or all at once. Upload, replace, download or remove one PDF, Word or image contract up to 10 MB. Formação: organiza departamentos, hierarquias de cargos, rotinas diárias e SOPs por função. Os modelos iniciais são rascunhos editáveis; cada SOP pode ser validado, revisto ou arquivado. As restantes duas áreas são marcadas como pendentes de configuração.

Data is stored in Supabase (Postgres). The app server talks to it with the secret key through the `exec_sql` function (see `db/raw.ts`); contracts and operator attachments use the private Supabase Storage bucket `umbral-files`. The properties table stores validated aggregate records and an optimistic concurrency version. The client keeps unsubmitted edits in memory, warns before leaving, and preserves input on save failures. Corporate agreements use versioned D1 records and a relational junction table with foreign keys; referenced properties cannot be deleted until unlinked. Formação uses a versioned D1 workspace containing departments, role hierarchy, routines and SOP steps. Contract files use private Supabase Storage, with download through the app and replacement cleanup after successful database writes. No business data is stored in localStorage.

## Access

This first deployment uses Sites owner-private access. Access is enforced by the hosting platform. Team sharing and role permissions have not been configured; review authorization before widening the audience.

## Development

Preserve pnpm-lock.yaml. Use Sites build and preview helpers. The database schema lives in `supabase/migrations` (apply it in the Supabase SQL editor or with the Supabase MCP). Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY and SUPABASE_JWKS_URL in `.env` locally and in the hosting environment. `scripts/migrate-d1-to-supabase.py` copies the old local D1 data.

## Verification

TypeScript check and production build. Browser workflow verifies required name validation, room inventory, rates, operator commission and linked rates, amenities with rules, operational policies, save, reload and edit. Corporate workflow verifies required fields, invalid discount rejection, checkbox selection, unsaved navigation protection, attachment upload, persisted records and contract metadata. Formação verifies the seeded departmental hierarchy, role routine and SOP views in the managed preview. Preview data is separate from production. WebMCP read tools are feature-detected; execution validation is unavailable because the preview browser reports modelContext unavailable.

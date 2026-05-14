# TODO

- [x] Add defensive Supabase migration to ensure `public.audit_log` has required columns:
  - [x] `entity_type text`
  - [x] `entity_id text`
  - [x] `action text`
  - [x] `"timestamp" timestamptz`
  - [x] `user_id uuid`
- [x] Include safe backfill for `entity_type` from possible legacy column names when available.
- [x] Ensure required indexes/policy compatibility remains intact.
- [x] Verify migration file is in `supabase/migrations` with a new timestamped name.
- [ ] Apply migration to target Supabase project.
- [ ] Verify Settings → Audit Log loads without `entity_type` missing error.

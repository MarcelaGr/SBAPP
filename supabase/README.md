# Supabase updates

Run `supabase/migrations/20260419_core_stabilization.sql` before deploying the app changes.

This migration adds:
- enforced `admin` / `attorney` roles on `staff`
- `sb_number` on `clients`
- one-invoice-per-case-per-period protection
- chat notification storage
- optional case-linked chat channels
- initial profile seeds for `muna@stonebusailah.com` and `marcela@stonebusailah.com` after those auth users exist

Create the two auth users first in Supabase Auth:
- `muna@stonebusailah.com`
- `marcela@stonebusailah.com`

Then run the migration so their `staff` rows are created with the correct roles.

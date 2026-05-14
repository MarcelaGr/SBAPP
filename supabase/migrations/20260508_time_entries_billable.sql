-- Add billable column to time_entries table for non-billable time tracking
alter table public.time_entries
  add column if not exists billable boolean not null default true;

-- Create index for filtering billable/non-billable entries
create index if not exists time_entries_billable_status_idx
  on public.time_entries (case_id, billable, status, entry_date);

-- Add audit trigger if not already present
drop trigger if exists audit_time_entries_trigger on public.time_entries;
create trigger audit_time_entries_trigger
after insert or update or delete on public.time_entries
for each row execute function public.write_audit_log();

alter table public.clients
  add column if not exists title text,
  add column if not exists serial_number text;

alter table public.cases
  add column if not exists serial_number text;

alter table public.calendar_events
  drop constraint if exists calendar_events_event_type_check;

alter table public.calendar_events
  add constraint calendar_events_event_type_check
  check (event_type in ('hearing', 'meeting', 'deadline', 'reminder', 'other'));

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  action text not null check (action in ('create', 'update', 'delete')),
  "timestamp" timestamptz not null default now(),
  user_id uuid references public.staff(id) on delete set null
);

create index if not exists audit_log_timestamp_idx
  on public.audit_log ("timestamp" desc);

create index if not exists audit_log_entity_idx
  on public.audit_log (entity_type, entity_id, "timestamp" desc);

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  target_id text;
  audit_action text;
begin
  actor_id := auth.uid();
  target_id := coalesce(new.id, old.id)::text;
  audit_action := lower(tg_op);

  insert into public.audit_log (entity_type, entity_id, action, "timestamp", user_id)
  values (tg_table_name, target_id, audit_action, now(), actor_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists audit_clients_trigger on public.clients;
create trigger audit_clients_trigger
after insert or update or delete on public.clients
for each row execute function public.write_audit_log();

drop trigger if exists audit_cases_trigger on public.cases;
create trigger audit_cases_trigger
after insert or update or delete on public.cases
for each row execute function public.write_audit_log();

drop trigger if exists audit_time_entries_trigger on public.time_entries;
create trigger audit_time_entries_trigger
after insert or update or delete on public.time_entries
for each row execute function public.write_audit_log();

drop trigger if exists audit_calendar_events_trigger on public.calendar_events;
create trigger audit_calendar_events_trigger
after insert or update or delete on public.calendar_events
for each row execute function public.write_audit_log();

drop trigger if exists audit_associations_trigger on public.associations;
create trigger audit_associations_trigger
after insert or update or delete on public.associations
for each row execute function public.write_audit_log();

drop trigger if exists audit_staff_trigger on public.staff;
create trigger audit_staff_trigger
after insert or update or delete on public.staff
for each row execute function public.write_audit_log();

drop trigger if exists audit_rate_table_trigger on public.rate_table;
create trigger audit_rate_table_trigger
after insert or update or delete on public.rate_table
for each row execute function public.write_audit_log();

drop trigger if exists audit_invoices_trigger on public.invoices;
create trigger audit_invoices_trigger
after insert or update or delete on public.invoices
for each row execute function public.write_audit_log();

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_read_authenticated" on public.audit_log;
create policy "audit_log_read_authenticated"
  on public.audit_log
  for select
  to authenticated
  using (true);

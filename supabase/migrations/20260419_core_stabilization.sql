-- Core stabilization migration for invoices, messaging, roles, SB numbers, and notifications.

alter table public.staff
  add column if not exists email text;

alter table public.staff
  add column if not exists role text default 'attorney';

alter table public.staff
  add column if not exists active boolean default true;

update public.staff
set role = case
  when lower(coalesce(role, '')) = 'admin' then 'admin'
  else 'attorney'
end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_role_check'
  ) then
    alter table public.staff
      add constraint staff_role_check
      check (role in ('admin', 'attorney'));
  end if;
end $$;

alter table public.clients
  add column if not exists sb_number text;

alter table public.message_channels
  add column if not exists case_id uuid references public.cases(id) on delete set null;

alter table public.message_channels
  add column if not exists last_message_at timestamptz;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  type text not null default 'message',
  title text not null,
  body text,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_staff_created_at_idx
  on public.notifications (staff_id, created_at desc);

create unique index if not exists cases_sb_number_unique_idx
  on public.cases (upper(sb_number))
  where sb_number is not null;

create unique index if not exists clients_sb_number_unique_idx
  on public.clients (upper(sb_number))
  where sb_number is not null;

create unique index if not exists invoices_one_case_per_period_idx
  on public.invoices (case_id, period_month, period_year, invoice_kind)
  where invoice_kind = 'case' and case_id is not null;

create index if not exists invoices_period_case_lookup_idx
  on public.invoices (period_year, period_month, case_id);

create index if not exists cases_client_lookup_idx
  on public.cases (client_id, sb_number);

create index if not exists calendar_events_case_lookup_idx
  on public.calendar_events (case_id, event_date);

create index if not exists time_entries_case_lookup_idx
  on public.time_entries (case_id, entry_date);

insert into public.staff (id, full_name, initials, email, role, active)
select au.id, 'Muna', 'MU', au.email, 'admin', true
from auth.users au
where lower(au.email) = 'muna@stonebusailah.com'
on conflict (id) do update
set full_name = excluded.full_name,
    initials = excluded.initials,
    email = excluded.email,
    role = excluded.role,
    active = excluded.active;

insert into public.staff (id, full_name, initials, email, role, active)
select au.id, 'Marcela', 'MA', au.email, 'attorney', true
from auth.users au
where lower(au.email) = 'marcela@stonebusailah.com'
on conflict (id) do update
set full_name = excluded.full_name,
    initials = excluded.initials,
    email = excluded.email,
    role = excluded.role,
    active = excluded.active;

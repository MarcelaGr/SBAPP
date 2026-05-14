-- Defensive compatibility migration for environments where audit_log schema drifted.
-- Fixes runtime error: "column audit_log.entity_type does not exist"

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  action text not null check (action in ('create', 'update', 'delete')),
  "timestamp" timestamptz not null default now(),
  user_id uuid references public.staff(id) on delete set null
);

alter table public.audit_log
  add column if not exists entity_type text;

alter table public.audit_log
  add column if not exists entity_id text;

alter table public.audit_log
  add column if not exists action text;

alter table public.audit_log
  add column if not exists "timestamp" timestamptz default now();

alter table public.audit_log
  add column if not exists user_id uuid references public.staff(id) on delete set null;

do $$
begin
  -- Backfill entity_type from common legacy names if present.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_log'
      and column_name = 'table_name'
  ) then
    execute 'update public.audit_log set entity_type = coalesce(entity_type, table_name)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_log'
      and column_name = 'entity_name'
  ) then
    execute 'update public.audit_log set entity_type = coalesce(entity_type, entity_name)';
  end if;
end $$;

-- Best-effort normalization to keep app queries safe.
update public.audit_log
set entity_type = coalesce(entity_type, 'unknown')
where entity_type is null;

update public.audit_log
set entity_id = coalesce(entity_id, id::text)
where entity_id is null;

update public.audit_log
set action = coalesce(action, 'update')
where action is null;

update public.audit_log
set "timestamp" = coalesce("timestamp", now())
where "timestamp" is null;

create index if not exists audit_log_timestamp_idx
  on public.audit_log ("timestamp" desc);

create index if not exists audit_log_entity_idx
  on public.audit_log (entity_type, entity_id, "timestamp" desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_read_authenticated" on public.audit_log;
create policy "audit_log_read_authenticated"
  on public.audit_log
  for select
  to authenticated
  using (true);

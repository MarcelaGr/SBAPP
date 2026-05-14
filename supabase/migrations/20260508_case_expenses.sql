create table if not exists public.case_expenses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  category text not null default 'Miscellaneous expenses',
  amount numeric(12,2) not null default 0 check (amount >= 0),
  expense_date date not null default current_date,
  notes text,
  receipt_file_name text,
  receipt_file_path text,
  receipt_file_size_kb integer,
  billable boolean not null default true,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_expenses_category_check'
      and conrelid = 'public.case_expenses'::regclass
  ) then
    alter table public.case_expenses
      add constraint case_expenses_category_check
      check (category in (
        'Court fees',
        'Filing costs',
        'Mileage',
        'Reimbursements',
        'Travel expenses',
        'Copy/printing expenses',
        'Investigation costs',
        'Expert witness costs',
        'Miscellaneous expenses'
      ));
  end if;
end $$;

create index if not exists case_expenses_case_date_idx
  on public.case_expenses (case_id, expense_date desc);

create index if not exists case_expenses_billable_date_idx
  on public.case_expenses (case_id, billable, expense_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_case_expenses_updated_at on public.case_expenses;
create trigger set_case_expenses_updated_at
before update on public.case_expenses
for each row execute function public.set_updated_at();

drop trigger if exists audit_case_expenses_trigger on public.case_expenses;
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'write_audit_log'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    create trigger audit_case_expenses_trigger
    after insert or update or delete on public.case_expenses
    for each row execute function public.write_audit_log();
  end if;
end $$;

-- Add time_entry_expenses table for tracking expenses within timeslips
create table if not exists public.time_entry_expenses (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
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
    where conname = 'time_entry_expenses_category_check'
      and conrelid = 'public.time_entry_expenses'::regclass
  ) then
    alter table public.time_entry_expenses
      add constraint time_entry_expenses_category_check
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

create index if not exists time_entry_expenses_time_entry_idx
  on public.time_entry_expenses (time_entry_id);

create index if not exists time_entry_expenses_case_date_idx
  on public.time_entry_expenses (case_id, expense_date desc);

create index if not exists time_entry_expenses_billable_date_idx
  on public.time_entry_expenses (case_id, billable, expense_date);

drop trigger if exists set_time_entry_expenses_updated_at on public.time_entry_expenses;
create trigger set_time_entry_expenses_updated_at
before update on public.time_entry_expenses
for each row execute function public.set_updated_at();

drop trigger if exists audit_time_entry_expenses_trigger on public.time_entry_expenses;
create trigger audit_time_entry_expenses_trigger
after insert or update or delete on public.time_entry_expenses
for each row execute function public.write_audit_log();

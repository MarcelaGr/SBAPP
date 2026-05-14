-- Trust & Retainer Account Management
-- Supports escrow/retainer tracking with immutable ledger and no-negative balances

create table if not exists public.trust_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  current_balance numeric(12,2) not null default 0 check (current_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id)
);

create index if not exists trust_accounts_client_idx on public.trust_accounts(client_id);
create index if not exists trust_accounts_case_idx on public.trust_accounts(case_id);

create table if not exists public.trust_transactions (
  id uuid primary key default gen_random_uuid(),
  trust_account_id uuid not null references public.trust_accounts(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('deposit', 'withdrawal', 'invoice_payment')),
  amount numeric(12,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  client_id uuid not null references public.clients(id) on delete restrict,
  case_id uuid not null references public.cases(id) on delete restrict,
  invoice_id uuid null references public.invoices(id) on delete set null,
  notes text null,
  performed_by uuid null references public.staff(id) on delete set null,
  running_balance numeric(12,2) not null check (running_balance >= 0),
  created_at timestamptz not null default now()
);

create index if not exists trust_transactions_account_created_idx
  on public.trust_transactions (trust_account_id, created_at asc);

create index if not exists trust_transactions_case_created_idx
  on public.trust_transactions (case_id, created_at desc);

create index if not exists trust_transactions_client_created_idx
  on public.trust_transactions (client_id, created_at desc);

create index if not exists trust_transactions_invoice_idx
  on public.trust_transactions (invoice_id);

create or replace function public.set_trust_accounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_trust_accounts_set_updated_at on public.trust_accounts;
create trigger trg_trust_accounts_set_updated_at
before update on public.trust_accounts
for each row execute function public.set_trust_accounts_updated_at();

create or replace function public.prevent_trust_transaction_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'trust_transactions are immutable and cannot be modified';
end;
$$;

drop trigger if exists trg_trust_transactions_no_update on public.trust_transactions;
create trigger trg_trust_transactions_no_update
before update on public.trust_transactions
for each row execute function public.prevent_trust_transaction_mutation();

drop trigger if exists trg_trust_transactions_no_delete on public.trust_transactions;
create trigger trg_trust_transactions_no_delete
before delete on public.trust_transactions
for each row execute function public.prevent_trust_transaction_mutation();

create or replace function public.record_trust_transaction(
  p_case_id uuid,
  p_client_id uuid,
  p_transaction_type text,
  p_amount numeric,
  p_transaction_date date default current_date,
  p_notes text default null,
  p_performed_by uuid default null,
  p_invoice_id uuid default null
)
returns public.trust_transactions
language plpgsql
security definer
as $$
declare
  v_account public.trust_accounts;
  v_new_balance numeric(12,2);
  v_tx public.trust_transactions;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_transaction_type not in ('deposit', 'withdrawal', 'invoice_payment') then
    raise exception 'Invalid transaction type: %', p_transaction_type;
  end if;

  insert into public.trust_accounts (client_id, case_id)
  values (p_client_id, p_case_id)
  on conflict (case_id) do nothing;

  select *
    into v_account
  from public.trust_accounts
  where case_id = p_case_id
  for update;

  if not found then
    raise exception 'Unable to locate trust account for case %', p_case_id;
  end if;

  if p_transaction_type = 'deposit' then
    v_new_balance := v_account.current_balance + p_amount;
  else
    v_new_balance := v_account.current_balance - p_amount;
  end if;

  if v_new_balance < 0 then
    raise exception 'Insufficient trust balance. Current balance: %, attempted amount: %', v_account.current_balance, p_amount;
  end if;

  insert into public.trust_transactions (
    trust_account_id,
    transaction_type,
    amount,
    transaction_date,
    client_id,
    case_id,
    invoice_id,
    notes,
    performed_by,
    running_balance
  ) values (
    v_account.id,
    p_transaction_type,
    p_amount,
    coalesce(p_transaction_date, current_date),
    p_client_id,
    p_case_id,
    p_invoice_id,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_performed_by,
    v_new_balance
  )
  returning * into v_tx;

  update public.trust_accounts
  set current_balance = v_new_balance
  where id = v_account.id;

  return v_tx;
end;
$$;

create or replace function public.apply_trust_to_invoice(
  p_invoice_id uuid,
  p_amount numeric,
  p_transaction_date date default current_date,
  p_notes text default null,
  p_performed_by uuid default null
)
returns public.trust_transactions
language plpgsql
security definer
as $$
declare
  v_invoice record;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select i.id, i.case_id, i.client_id
    into v_invoice
  from public.invoices i
  where i.id = p_invoice_id;

  if not found then
    raise exception 'Invoice not found: %', p_invoice_id;
  end if;

  return public.record_trust_transaction(
    p_case_id => v_invoice.case_id,
    p_client_id => v_invoice.client_id,
    p_transaction_type => 'invoice_payment',
    p_amount => p_amount,
    p_transaction_date => coalesce(p_transaction_date, current_date),
    p_notes => coalesce(p_notes, 'Applied to invoice'),
    p_performed_by => p_performed_by,
    p_invoice_id => p_invoice_id
  );
end;
$$;

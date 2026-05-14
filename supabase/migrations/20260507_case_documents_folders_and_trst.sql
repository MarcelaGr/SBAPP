alter table public.documents
  add column if not exists folder text not null default 'Notes';

update public.documents
set folder = case
  when file_path like '%/audio/%' then 'Audio'
  when file_path like '%/authorization/%' then 'Authorization'
  when file_path like '%/billing/%' then 'Billing'
  when file_path like '%/correspondense/%' then 'Correspondense'
  when file_path like '%/drafts/%' then 'Drafts'
  when file_path like '%/notes/%' then 'Notes'
  when file_path like '%/pleadings/%' then 'Pleadings'
  when file_path like '%/scans/%' then 'Scans'
  when file_path like '%/status-reports/%' then 'Status Reports'
  else coalesce(nullif(folder, ''), 'Notes')
end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_folder_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_folder_check
      check (folder in (
        'Audio',
        'Authorization',
        'Billing',
        'Correspondense',
        'Drafts',
        'Notes',
        'Pleadings',
        'Scans',
        'Status Reports'
      ));
  end if;
end $$;

create index if not exists documents_case_folder_created_idx
  on public.documents (case_id, folder, created_at desc);

update public.cases
set case_type = 'TRST'
where case_type = 'TRS';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'cases_case_type_check'
      and conrelid = 'public.cases'::regclass
  ) then
    alter table public.cases
      drop constraint cases_case_type_check;
  end if;

  alter table public.cases
    add constraint cases_case_type_check
    check (case_type is null or case_type in ('TRST', 'FL-TRST'));
exception
  when duplicate_object then null;
end $$;

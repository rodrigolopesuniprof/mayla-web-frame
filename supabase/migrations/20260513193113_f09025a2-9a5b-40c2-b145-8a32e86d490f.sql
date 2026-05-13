alter table public.profiles
  add column if not exists birthdate date,
  add column if not exists sex text check (sex in ('M','F'));
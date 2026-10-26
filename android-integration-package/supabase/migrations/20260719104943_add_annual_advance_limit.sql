alter table public.profiles
add column if not exists annual_advance_limit numeric default 10000 not null;

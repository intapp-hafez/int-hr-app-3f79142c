create or replace function public.import_employee_profile(
  _full_name text,
  _email text,
  _phone text default null,
  _role public.app_role default 'employee',
  _city text default null,
  _district text default null,
  _department_id uuid default null,
  _position_id uuid default null,
  _status text default 'Active',
  _avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _existing_id uuid;
  _new_id uuid;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'hr')) then
    raise exception 'Only admins or HR can import employees';
  end if;

  _email := lower(trim(coalesce(_email, '')));
  _full_name := nullif(trim(coalesce(_full_name, '')), '');

  if _full_name is null then
    raise exception 'Name is required';
  end if;

  if _email = '' then
    raise exception 'Email is required';
  end if;

  select id into _existing_id
  from public.profiles
  where lower(email) = _email
  limit 1;

  if _existing_id is not null then
    raise exception 'Email already exists';
  end if;

  _new_id := gen_random_uuid();

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    city,
    district,
    department_id,
    position_id,
    status,
    avatar_url
  ) values (
    _new_id,
    _full_name,
    _email,
    nullif(trim(coalesce(_phone, '')), ''),
    _role,
    nullif(trim(coalesce(_city, '')), ''),
    nullif(trim(coalesce(_district, '')), ''),
    _department_id,
    _position_id,
    case when _status = 'Inactive' then 'Inactive' else 'Active' end,
    nullif(trim(coalesce(_avatar_url, '')), '')
  );

  insert into public.user_roles (user_id, role)
  values (_new_id, _role)
  on conflict (user_id, role) do nothing;

  return _new_id;
end;
$$;

grant execute on function public.import_employee_profile(text, text, text, public.app_role, text, text, uuid, uuid, text, text) to authenticated;
grant execute on function public.import_employee_profile(text, text, text, public.app_role, text, text, uuid, uuid, text, text) to service_role;
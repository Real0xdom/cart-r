-- Differentiate customer and driver app usage without changing the shared auth model.

alter table public.users
  add column if not exists customer_app_enabled boolean not null default true;

alter table public.drivers
  add column if not exists driver_app_enabled boolean not null default true;

alter table public.push_tokens
  add column if not exists app_type text;

update public.push_tokens pt
set app_type = case
  when exists (
    select 1
    from public.drivers d
    where d.user_id = pt.user_id
  ) then 'driver'
  else 'customer'
end
where pt.app_type is null;

alter table public.push_tokens
  alter column app_type set default 'customer';

alter table public.push_tokens
  alter column app_type set not null;

alter table public.push_tokens
  drop constraint if exists push_tokens_app_type_check;

alter table public.push_tokens
  add constraint push_tokens_app_type_check
  check (app_type in ('customer', 'driver'));

alter table public.push_tokens
  drop constraint if exists unique_user_device;

alter table public.push_tokens
  add constraint unique_user_device_app unique (user_id, device_id, app_type);

create index if not exists idx_push_tokens_user_app_active
  on public.push_tokens (user_id, app_type, is_active);

-- Ensure push_tokens has the expected RLS policies in every environment.

alter table public.push_tokens enable row level security;

grant select, insert, update, delete on table public.push_tokens to authenticated;

drop policy if exists "Users can view own push tokens" on public.push_tokens;
create policy "Users can view own push tokens"
  on public.push_tokens
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own push tokens" on public.push_tokens;
create policy "Users can manage own push tokens"
  on public.push_tokens
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own push tokens" on public.push_tokens;
create policy "Users can update own push tokens"
  on public.push_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own push tokens" on public.push_tokens;
create policy "Users can delete own push tokens"
  on public.push_tokens
  for delete
  using (auth.uid() = user_id);

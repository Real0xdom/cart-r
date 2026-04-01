-- Remove duplicate push-token rows and prevent the same token from being
-- stored multiple times for the same user/app combination.

with ranked_tokens as (
  select
    id,
    row_number() over (
      partition by user_id, app_type, token
      order by
        is_active desc,
        updated_at desc nulls last,
        created_at desc nulls last,
        id desc
    ) as rn
  from public.push_tokens
)
delete from public.push_tokens pt
using ranked_tokens rt
where pt.id = rt.id
  and rt.rn > 1;

create unique index if not exists idx_push_tokens_user_app_token_unique
  on public.push_tokens (user_id, app_type, token);

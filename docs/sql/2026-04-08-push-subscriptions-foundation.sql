create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  expiration_time bigint,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  browser_language text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  disabled_at timestamptz
);

comment on table public.push_subscriptions is
'Web push subscriptions for authenticated app users. First pass is chat-first and browser/device scoped.';

comment on column public.push_subscriptions.endpoint is
'Push service endpoint for one browser/device subscription. Kept unique so a rotated or rebound endpoint stays singular.';

comment on column public.push_subscriptions.disabled_at is
'Soft-disable timestamp for subscriptions that were removed or expired. Retained for cleanup and diagnostics.';

create unique index if not exists push_subscriptions_endpoint_unique_idx
on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_user_id_active_idx
on public.push_subscriptions (user_id, updated_at desc)
where disabled_at is null;

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own
on public.push_subscriptions;

drop policy if exists push_subscriptions_insert_own
on public.push_subscriptions;

drop policy if exists push_subscriptions_update_own
on public.push_subscriptions;

drop policy if exists push_subscriptions_delete_own
on public.push_subscriptions;

create policy push_subscriptions_select_own
on public.push_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create policy push_subscriptions_insert_own
on public.push_subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy push_subscriptions_update_own
on public.push_subscriptions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy push_subscriptions_delete_own
on public.push_subscriptions
for delete
to authenticated
using (auth.uid() = user_id);

notify pgrst, 'reload schema';

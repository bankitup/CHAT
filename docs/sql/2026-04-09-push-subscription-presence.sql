alter table public.push_subscriptions
  add column if not exists presence_updated_at timestamptz null,
  add column if not exists active_conversation_id uuid null references public.conversations (id) on delete set null;

comment on column public.push_subscriptions.presence_updated_at is
'Most recent in-app presence heartbeat for this subscribed browser/device. Null means not currently marked present.';

comment on column public.push_subscriptions.active_conversation_id is
'Current visible conversation for this subscribed browser/device when the app is active. Used to suppress same-chat push delivery.';

create index if not exists push_subscriptions_presence_active_idx
on public.push_subscriptions (user_id, presence_updated_at desc)
where disabled_at is null and presence_updated_at is not null;

notify pgrst, 'reload schema';

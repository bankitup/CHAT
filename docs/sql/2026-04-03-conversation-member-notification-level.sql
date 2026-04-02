alter table public.conversation_members
add column if not exists notification_level text not null default 'default';

alter table public.conversation_members
drop constraint if exists conversation_members_notification_level_check;

alter table public.conversation_members
add constraint conversation_members_notification_level_check
check (notification_level in ('default', 'muted'));

comment on column public.conversation_members.notification_level is
'User-specific per-conversation notification preference. First pass supports default or muted.';

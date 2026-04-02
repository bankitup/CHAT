alter table public.conversation_members
add column if not exists hidden_at timestamptz;

comment on column public.conversation_members.hidden_at is
'User-specific inbox hide/archive timestamp. Hidden conversations stay active and retain full history.';

create index if not exists conversation_members_user_active_visible_idx
on public.conversation_members (user_id, conversation_id)
where state = 'active' and hidden_at is null;

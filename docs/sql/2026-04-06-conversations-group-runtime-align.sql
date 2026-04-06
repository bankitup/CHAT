alter table public.conversations
add column if not exists avatar_path text;

comment on column public.conversations.avatar_path is
'Optional managed avatar object path for group chat identity. Stored in the private avatars bucket and resolved through signed URLs.';

alter table public.conversations
add column if not exists join_policy text;

update public.conversations
set join_policy = 'closed'
where join_policy is null;

alter table public.conversations
alter column join_policy set default 'closed';

alter table public.conversations
alter column join_policy set not null;

comment on column public.conversations.join_policy is
'Group chat privacy policy. closed = invite-only, open = active members may add participants.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_join_policy_check'
  ) then
    alter table public.conversations
    add constraint conversations_join_policy_check
    check (join_policy in ('open', 'closed'));
  end if;
end
$$;

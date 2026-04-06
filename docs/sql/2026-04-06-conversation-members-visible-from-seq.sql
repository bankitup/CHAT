alter table public.conversation_members
add column if not exists visible_from_seq bigint;

comment on column public.conversation_members.visible_from_seq is
'Member-scoped visible history baseline. Messages with seq below this boundary remain stored but are hidden from the active UX for that member.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversation_members_visible_from_seq_check'
  ) then
    alter table public.conversation_members
    add constraint conversation_members_visible_from_seq_check
    check (visible_from_seq is null or visible_from_seq >= 1);
  end if;
end
$$;

create index if not exists conversation_members_visible_from_seq_idx
  on public.conversation_members (conversation_id, user_id, visible_from_seq);

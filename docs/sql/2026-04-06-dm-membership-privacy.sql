create or replace function public.enforce_dm_membership_privacy()
returns trigger
language plpgsql
as $$
declare
  target_conversation_id public.conversation_members.conversation_id%type;
  target_kind text;
  active_participant_count integer;
begin
  target_conversation_id := new.conversation_id;

  select c.kind
  into target_kind
  from public.conversations c
  where c.id = target_conversation_id;

  if target_kind is distinct from 'dm' then
    return new;
  end if;

  if coalesce(new.role, 'member') <> 'member' then
    raise exception
      'DM conversations cannot use owner/admin roles.'
      using errcode = 'check_violation';
  end if;

  if coalesce(new.state, 'active') <> 'active' then
    raise exception
      'DM conversations must keep memberships active. Use hidden_at for user-scoped removal.'
      using errcode = 'check_violation';
  end if;

  select count(distinct cm.user_id)
  into active_participant_count
  from public.conversation_members cm
  where cm.conversation_id = target_conversation_id
    and cm.state = 'active';

  if active_participant_count > 2 then
    raise exception
      'DM conversations cannot have more than two active participants.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists conversation_members_enforce_dm_privacy
on public.conversation_members;

create trigger conversation_members_enforce_dm_privacy
after insert or update of conversation_id, user_id, state, role
on public.conversation_members
for each row
execute function public.enforce_dm_membership_privacy();

comment on function public.enforce_dm_membership_privacy() is
'Prevents DM membership expansion beyond two active users and blocks owner/admin role semantics on DM memberships.';

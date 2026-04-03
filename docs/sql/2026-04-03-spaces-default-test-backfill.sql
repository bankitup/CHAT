do $$
declare
  v_test_space_id uuid;
  v_test_owner_id uuid;
begin
  select spaces.id
  into v_test_space_id
  from public.spaces
  where lower(trim(spaces.name)) = 'test'
  order by spaces.created_at asc
  limit 1;

  if v_test_space_id is null then
    select users.id
    into v_test_owner_id
    from auth.users as users
    order by users.created_at asc
    limit 1;

    if v_test_owner_id is null then
      raise exception 'Cannot seed default TEST space without at least one auth.users row.';
    end if;

    insert into public.spaces (name, created_by)
    values ('TEST', v_test_owner_id)
    returning id into v_test_space_id;
  else
    select spaces.created_by
    into v_test_owner_id
    from public.spaces as spaces
    where spaces.id = v_test_space_id;
  end if;

  update public.conversations
  set space_id = v_test_space_id
  where space_id is null;

  if v_test_owner_id is not null then
    insert into public.space_members (space_id, user_id, role)
    values (v_test_space_id, v_test_owner_id, 'owner')
    on conflict (space_id, user_id) do update
      set role = 'owner';
  end if;

  insert into public.space_members (space_id, user_id, role)
  select distinct
    v_test_space_id,
    conversation_members.user_id,
    case
      when conversation_members.user_id = v_test_owner_id then 'owner'
      else 'member'
    end
  from public.conversation_members
  where conversation_members.user_id is not null
  on conflict (space_id, user_id) do nothing;
end $$;

comment on table public.spaces is
'Top-level container for a project, team, or client context. Current MVP activity is backfilled into the default TEST space first.';

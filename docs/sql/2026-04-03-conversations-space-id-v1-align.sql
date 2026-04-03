-- Temporary v1 operational alignment:
-- Ensure `public.conversations.space_id` exists and backfill legacy rows into
-- the default TEST space so space-scoped inbox/activity/chat loaders can run.

do $$
begin
  if to_regclass('public.spaces') is null then
    raise exception
      'Missing public.spaces. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql first.';
  end if;
end $$;

alter table public.conversations
add column if not exists space_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_space_id_fkey'
      and conrelid = 'public.conversations'::regclass
  ) then
    alter table public.conversations
    add constraint conversations_space_id_fkey
    foreign key (space_id)
    references public.spaces (id)
    on delete cascade;
  end if;
end $$;

comment on column public.conversations.space_id is
'Parent space for the conversation. DMs and groups are scoped to one space and are not global.';

create index if not exists conversations_space_id_idx
on public.conversations (space_id);

do $$
declare
  v_test_space_id uuid;
  v_test_owner_id uuid;
begin
  select spaces.id
  into v_test_space_id
  from public.spaces as spaces
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
      raise exception
        'Cannot seed default TEST space without at least one auth.users row.';
    end if;

    insert into public.spaces (name, created_by)
    values ('TEST', v_test_owner_id)
    returning id into v_test_space_id;
  end if;

  update public.conversations
  set space_id = v_test_space_id
  where space_id is null;
end $$;

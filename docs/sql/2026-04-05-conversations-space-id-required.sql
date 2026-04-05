-- Final active-space alignment for conversations.
-- Safe to run after the earlier spaces-v1 / align migrations, and also safe
-- on databases that drifted and never received them completely.

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
'Required parent space for every conversation. DMs and groups are scoped to one active space and must not be global.';

create index if not exists conversations_space_id_idx
on public.conversations (space_id);

drop index if exists public.conversations_dm_key_unique_idx;

create unique index if not exists conversations_dm_key_unique_legacy_idx
on public.conversations (dm_key)
where kind = 'dm' and dm_key is not null and space_id is null;

create unique index if not exists conversations_space_dm_key_unique_idx
on public.conversations (space_id, dm_key)
where kind = 'dm' and dm_key is not null and space_id is not null;

comment on index public.conversations_space_dm_key_unique_idx is
'Makes direct-message uniqueness space-scoped once conversations are assigned to explicit spaces.';

do $$
declare
  v_default_space_id uuid;
  v_default_owner_id uuid;
begin
  select spaces.id
  into v_default_space_id
  from public.spaces as spaces
  order by
    case when lower(trim(spaces.name)) = 'test' then 0 else 1 end,
    spaces.created_at asc
  limit 1;

  if v_default_space_id is null then
    select users.id
    into v_default_owner_id
    from auth.users as users
    order by users.created_at asc
    limit 1;

    if v_default_owner_id is null then
      raise exception
        'Cannot backfill public.conversations.space_id without at least one auth.users row.';
    end if;

    insert into public.spaces (name, created_by)
    values ('TEST', v_default_owner_id)
    returning id into v_default_space_id;
  end if;

  update public.conversations
  set space_id = v_default_space_id
  where space_id is null;
end $$;

do $$
begin
  if exists (
    select 1
    from public.conversations
    where space_id is null
  ) then
    raise exception
      'Backfill failed: public.conversations still contains rows with null space_id.';
  end if;
end $$;

alter table public.conversations
alter column space_id set not null;

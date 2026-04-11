-- Runtime compatibility patch for outer-tenancy reads.
-- Current app code orders and projects public.space_members.joined_at.
-- Older rollout files used created_at instead.

alter table public.space_members
  add column if not exists joined_at timestamptz default timezone('utc', now());

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'space_members'
      and column_name = 'created_at'
  ) then
    execute $sql$
      update public.space_members
      set joined_at = coalesce(joined_at, created_at, timezone('utc', now()))
      where joined_at is null
    $sql$;
  else
    update public.space_members
    set joined_at = coalesce(joined_at, timezone('utc', now()))
    where joined_at is null;
  end if;
end
$$;

alter table public.space_members
  alter column joined_at set default timezone('utc', now());

comment on column public.space_members.joined_at is
'Current membership-entered timestamp used by active-space ordering and participant surfaces.';

create index if not exists space_members_user_joined_at_idx
  on public.space_members (user_id, joined_at asc);

create index if not exists space_members_space_joined_at_idx
  on public.space_members (space_id, joined_at asc);

notify pgrst, 'reload schema';

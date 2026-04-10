-- First safe outer-tenancy RLS slice for CHAT MVP.
-- Goal:
-- - make visible spaces depend on actual membership
-- - keep same-space membership reads scoped safely
-- - keep create/manage-member writes on app-owned privileged server paths

grant select on public.spaces to authenticated;
grant select on public.space_members to authenticated;

grant select, insert, update, delete on public.spaces to service_role;
grant select, insert, update, delete on public.space_members to service_role;

revoke insert, update, delete on public.spaces from authenticated;
revoke insert, update, delete on public.space_members from authenticated;

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;

create or replace function public.is_current_user_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.space_members sm
    where sm.space_id = target_space_id
      and sm.user_id = auth.uid()
  );
$$;

comment on function public.is_current_user_space_member(uuid) is
'RLS helper for the CHAT MVP outer tenancy boundary. Returns true when auth.uid() belongs to the given space.';

revoke all on function public.is_current_user_space_member(uuid) from public;
grant execute on function public.is_current_user_space_member(uuid) to authenticated;
grant execute on function public.is_current_user_space_member(uuid) to service_role;

drop policy if exists spaces_select_member_spaces on public.spaces;
create policy spaces_select_member_spaces
on public.spaces
for select
to authenticated
using (public.is_current_user_space_member(id));

drop policy if exists space_members_select_own_or_same_space on public.space_members;
create policy space_members_select_own_or_same_space
on public.space_members
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_current_user_space_member(space_id)
);

notify pgrst, 'reload schema';

-- First conservative RLS hardening pass for the KeepCozy MVP persistence slice.
--
-- Goals:
-- - keep shared public.space_members as the current home-access truth
-- - allow all current home members to read rooms, issues, tasks, and history
-- - keep room writes limited to home owners/admins in the first pass
-- - allow issue/task writes for the creator plus home owners/admins
-- - keep issue_updates and task_updates append-only for authenticated users
-- - avoid premature assignment-aware, vendor-aware, or chat-aware policy logic

do $$
begin
  if to_regclass('public.rooms') is null then
    raise exception
      'Missing public.rooms. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql first.';
  end if;

  if to_regclass('public.issues') is null then
    raise exception
      'Missing public.issues. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql first.';
  end if;

  if to_regclass('public.issue_updates') is null then
    raise exception
      'Missing public.issue_updates. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql first.';
  end if;

  if to_regclass('public.tasks') is null then
    raise exception
      'Missing public.tasks. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql first.';
  end if;

  if to_regclass('public.task_updates') is null then
    raise exception
      'Missing public.task_updates. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql first.';
  end if;

  if to_regclass('public.space_members') is null then
    raise exception
      'Missing public.space_members. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql first.';
  end if;
end $$;

grant select, insert, update on public.rooms to authenticated;
grant select, insert, update on public.issues to authenticated;
grant select, insert on public.issue_updates to authenticated;
grant select, insert, update on public.tasks to authenticated;
grant select, insert on public.task_updates to authenticated;

grant select, insert, update, delete on public.rooms to service_role;
grant select, insert, update, delete on public.issues to service_role;
grant select, insert, update, delete on public.issue_updates to service_role;
grant select, insert, update, delete on public.tasks to service_role;
grant select, insert, update, delete on public.task_updates to service_role;

alter table public.rooms enable row level security;
alter table public.issues enable row level security;
alter table public.issue_updates enable row level security;
alter table public.tasks enable row level security;
alter table public.task_updates enable row level security;

drop policy if exists rooms_select_space_members on public.rooms;
create policy rooms_select_space_members
on public.rooms
for select
to authenticated
using (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = rooms.space_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists rooms_insert_space_admins on public.rooms;
create policy rooms_insert_space_admins
on public.rooms
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.space_members sm
    where sm.space_id = rooms.space_id
      and sm.user_id = auth.uid()
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists rooms_update_space_admins on public.rooms;
create policy rooms_update_space_admins
on public.rooms
for update
to authenticated
using (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = rooms.space_id
      and sm.user_id = auth.uid()
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = rooms.space_id
      and sm.user_id = auth.uid()
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists issues_select_space_members on public.issues;
create policy issues_select_space_members
on public.issues
for select
to authenticated
using (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = issues.space_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists issues_insert_space_members on public.issues;
create policy issues_insert_space_members
on public.issues
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.space_members sm
    where sm.space_id = issues.space_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists issues_update_creator_or_space_admins on public.issues;
create policy issues_update_creator_or_space_admins
on public.issues
for update
to authenticated
using (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = issues.space_id
      and sm.user_id = auth.uid()
      and (
        issues.created_by = auth.uid()
        or sm.role in ('owner', 'admin')
      )
  )
)
with check (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = issues.space_id
      and sm.user_id = auth.uid()
      and (
        issues.created_by = auth.uid()
        or sm.role in ('owner', 'admin')
      )
  )
);

drop policy if exists issue_updates_select_space_members on public.issue_updates;
create policy issue_updates_select_space_members
on public.issue_updates
for select
to authenticated
using (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = issue_updates.space_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists issue_updates_insert_space_members on public.issue_updates;
create policy issue_updates_insert_space_members
on public.issue_updates
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.space_members sm
    where sm.space_id = issue_updates.space_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists tasks_select_space_members on public.tasks;
create policy tasks_select_space_members
on public.tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = tasks.space_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists tasks_insert_space_members on public.tasks;
create policy tasks_insert_space_members
on public.tasks
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.space_members sm
    where sm.space_id = tasks.space_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists tasks_update_creator_or_space_admins on public.tasks;
create policy tasks_update_creator_or_space_admins
on public.tasks
for update
to authenticated
using (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = tasks.space_id
      and sm.user_id = auth.uid()
      and (
        tasks.created_by = auth.uid()
        or sm.role in ('owner', 'admin')
      )
  )
)
with check (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = tasks.space_id
      and sm.user_id = auth.uid()
      and (
        tasks.created_by = auth.uid()
        or sm.role in ('owner', 'admin')
      )
  )
);

drop policy if exists task_updates_select_space_members on public.task_updates;
create policy task_updates_select_space_members
on public.task_updates
for select
to authenticated
using (
  exists (
    select 1
    from public.space_members sm
    where sm.space_id = task_updates.space_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists task_updates_insert_space_members on public.task_updates;
create policy task_updates_insert_space_members
on public.task_updates
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.space_members sm
    where sm.space_id = task_updates.space_id
      and sm.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

-- Intentionally deferred in this first hardening pass:
-- - authenticated delete policies for rooms, issues, and tasks
-- - authenticated update/delete policies for issue_updates and task_updates
-- - assignment-aware or vendor-aware visibility rules
-- - policy widening beyond current shared public.space_members home membership
-- - conversation or chat-linked authorization seams

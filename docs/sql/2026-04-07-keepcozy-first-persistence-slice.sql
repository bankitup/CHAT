-- First dedicated persistence slice for the KeepCozy MVP runtime.
--
-- Design goals for this pass:
-- - keep public.spaces and public.space_members as the current home seam
-- - persist only rooms, issues, issue_updates, tasks, and task_updates
-- - preserve current route slugs from the preview-backed KeepCozy shell
-- - keep issue/task history append-oriented and audit-friendly
-- - avoid deep chat coupling, attachment expansion, and broader future-domain scope

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.spaces') is null then
    raise exception
      'Missing public.spaces. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql first.';
  end if;
end $$;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null
    references public.spaces (id)
    on delete cascade,
  slug text not null
    check (char_length(trim(slug)) > 0),
  name text not null
    check (char_length(trim(name)) > 0),
  summary text
    check (summary is null or char_length(trim(summary)) > 0),
  created_by uuid not null
    references auth.users (id)
    on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rooms_space_id_id_unique unique (space_id, id),
  constraint rooms_space_slug_unique unique (space_id, slug)
);

comment on table public.rooms is
'First-class KeepCozy room records inside one shared space/home boundary.';

comment on column public.rooms.space_id is
'Current home compatibility seam. Rooms are scoped to one shared space.';

comment on column public.rooms.slug is
'Route-friendly room identifier used by the KeepCozy-first shell.';

comment on column public.rooms.summary is
'Optional short room summary for mobile list and detail surfaces.';

create index if not exists rooms_space_name_idx
  on public.rooms (space_id, name);

create index if not exists rooms_space_created_at_idx
  on public.rooms (space_id, created_at desc, id desc);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null
    references public.spaces (id)
    on delete cascade,
  room_id uuid,
  slug text not null
    check (char_length(trim(slug)) > 0),
  title text not null
    check (char_length(trim(title)) > 0),
  summary text
    check (summary is null or char_length(trim(summary)) > 0),
  status text not null
    check (status in ('open', 'planned', 'in_review', 'resolved')),
  next_step text
    check (next_step is null or char_length(trim(next_step)) > 0),
  created_by uuid not null
    references auth.users (id)
    on delete restrict,
  resolved_by uuid
    references auth.users (id)
    on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  constraint issues_space_id_id_unique unique (space_id, id),
  constraint issues_space_slug_unique unique (space_id, slug),
  constraint issues_space_room_ref_fkey
    foreign key (space_id, room_id)
    references public.rooms (space_id, id)
    on delete set null,
  constraint issues_resolution_state_check
    check (
      (status = 'resolved' and resolved_at is not null)
      or (status <> 'resolved' and resolved_at is null)
    ),
  constraint issues_resolution_actor_check
    check (resolved_by is null or resolved_at is not null)
);

comment on table public.issues is
'First-class KeepCozy issue records. Issues are structured operational problem records, not chat threads.';

comment on column public.issues.room_id is
'Optional room linkage. Issues may remain home-scoped when no room is selected.';

comment on column public.issues.slug is
'Route-friendly issue identifier used by the KeepCozy-first shell.';

comment on column public.issues.next_step is
'Optional short next-step summary for list/detail cards before deeper workflow layers exist.';

create index if not exists issues_space_status_created_at_idx
  on public.issues (space_id, status, created_at desc, id desc);

create index if not exists issues_room_status_created_at_idx
  on public.issues (room_id, status, created_at desc, id desc)
  where room_id is not null;

create index if not exists issues_space_resolved_at_idx
  on public.issues (space_id, resolved_at desc, id desc)
  where resolved_at is not null;

create table if not exists public.issue_updates (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null
    references public.spaces (id)
    on delete cascade,
  issue_id uuid not null,
  label text not null
    check (char_length(trim(label)) > 0),
  body text not null
    check (char_length(trim(body)) > 0),
  kind text not null
    check (kind in ('note', 'status_change', 'resolution')),
  status_after text
    check (
      status_after is null
      or status_after in ('open', 'planned', 'in_review', 'resolved')
    ),
  created_by uuid not null
    references auth.users (id)
    on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint issue_updates_space_issue_ref_fkey
    foreign key (space_id, issue_id)
    references public.issues (space_id, id)
    on delete cascade,
  constraint issue_updates_status_after_kind_check
    check (
      status_after is null
      or kind in ('status_change', 'resolution')
    ),
  constraint issue_updates_resolution_status_check
    check (
      kind <> 'resolution'
      or status_after = 'resolved'
    )
);

comment on table public.issue_updates is
'Append-oriented issue history for KeepCozy MVP. Distinct from public.messages and intended for operational progress history.';

comment on column public.issue_updates.label is
'Short history label such as Issue logged or Initial assessment.';

create index if not exists issue_updates_issue_created_at_idx
  on public.issue_updates (issue_id, created_at asc, id asc);

create index if not exists issue_updates_space_created_at_idx
  on public.issue_updates (space_id, created_at desc, id desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null
    references public.spaces (id)
    on delete cascade,
  issue_id uuid not null,
  slug text not null
    check (char_length(trim(slug)) > 0),
  title text not null
    check (char_length(trim(title)) > 0),
  summary text
    check (summary is null or char_length(trim(summary)) > 0),
  status text not null
    check (status in ('planned', 'active', 'waiting', 'done', 'cancelled')),
  next_step text
    check (next_step is null or char_length(trim(next_step)) > 0),
  created_by uuid not null
    references auth.users (id)
    on delete restrict,
  completed_by uuid
    references auth.users (id)
    on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  constraint tasks_space_id_id_unique unique (space_id, id),
  constraint tasks_space_slug_unique unique (space_id, slug),
  constraint tasks_space_issue_ref_fkey
    foreign key (space_id, issue_id)
    references public.issues (space_id, id)
    on delete cascade,
  constraint tasks_completion_state_check
    check (
      (status = 'done' and completed_at is not null)
      or (status <> 'done' and completed_at is null)
    ),
  constraint tasks_completion_actor_check
    check (completed_by is null or completed_at is not null)
);

comment on table public.tasks is
'First-class KeepCozy task records linked to one issue. Tasks stay narrower than work orders in the MVP slice.';

comment on column public.tasks.issue_id is
'Parent issue reference. Room context is intentionally derived through the issue to avoid first-pass duplication.';

comment on column public.tasks.slug is
'Route-friendly task identifier used by the KeepCozy-first shell.';

create index if not exists tasks_space_status_created_at_idx
  on public.tasks (space_id, status, created_at desc, id desc);

create index if not exists tasks_issue_status_created_at_idx
  on public.tasks (issue_id, status, created_at desc, id desc);

create index if not exists tasks_space_completed_at_idx
  on public.tasks (space_id, completed_at desc, id desc)
  where completed_at is not null;

create table if not exists public.task_updates (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null
    references public.spaces (id)
    on delete cascade,
  task_id uuid not null,
  label text not null
    check (char_length(trim(label)) > 0),
  body text not null
    check (char_length(trim(body)) > 0),
  kind text not null
    check (kind in ('note', 'status_change', 'completion')),
  status_after text
    check (
      status_after is null
      or status_after in ('planned', 'active', 'waiting', 'done', 'cancelled')
    ),
  created_by uuid not null
    references auth.users (id)
    on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint task_updates_space_task_ref_fkey
    foreign key (space_id, task_id)
    references public.tasks (space_id, id)
    on delete cascade,
  constraint task_updates_status_after_kind_check
    check (
      status_after is null
      or kind in ('status_change', 'completion')
    ),
  constraint task_updates_completion_status_check
    check (
      kind <> 'completion'
      or status_after = 'done'
    )
);

comment on table public.task_updates is
'Append-oriented task progress history for KeepCozy MVP.';

comment on column public.task_updates.label is
'Short history label such as Task created or Scope held.';

create index if not exists task_updates_task_created_at_idx
  on public.task_updates (task_id, created_at asc, id asc);

create index if not exists task_updates_space_created_at_idx
  on public.task_updates (space_id, created_at desc, id desc);

-- Intentionally deferred in this first persistence draft:
-- - canonical TEST-home seed/backfill rows
-- - grants and row-level security policies
-- - write-path integration in runtime code
-- - updated_at triggers or generic timestamp helpers
-- - attachment linkage tables for issue/task updates
-- - unified space-timeline mirroring
-- - conversation or companion-metadata coupling

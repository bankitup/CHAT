-- Narrow canonical TEST-home seed for the first KeepCozy persisted MVP loop.
--
-- Goals:
-- - preserve the documented TEST home as the first proof path
-- - seed one room, one issue, one task, and minimal history only
-- - avoid broad fixture libraries or preview-parity backfills
-- - keep the seed idempotent and avoid overwriting existing local edits
-- - keep this seed as the shared baseline proof path, not a reset script
-- - allow reviewers to append fresh updates during validation without losing
--   the canonical faucet/task story
-- - keep the same canonical route slugs as the preview-backed shell:
--   /rooms/kitchen
--   /issues/kitchen-faucet-drip
--   /tasks/capture-faucet-model

do $$
declare
  v_test_space_id uuid;
  v_actor_id uuid;
  v_room_id uuid;
  v_issue_id uuid;
  v_task_id uuid;
begin
  if to_regclass('public.rooms') is null
    or to_regclass('public.issues') is null
    or to_regclass('public.issue_updates') is null
    or to_regclass('public.tasks') is null
    or to_regclass('public.task_updates') is null then
    raise exception
      'Missing KeepCozy MVP persistence tables. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql first.';
  end if;

  select spaces.id, spaces.created_by
  into v_test_space_id, v_actor_id
  from public.spaces as spaces
  where lower(trim(spaces.name)) = 'test'
  order by spaces.created_at asc
  limit 1;

  if v_test_space_id is null then
    raise exception
      'Missing TEST space. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-03-spaces-default-test-backfill.sql first.';
  end if;

  if v_actor_id is null then
    raise exception
      'TEST space is missing created_by. Recreate the TEST home through the documented shared space seed path before applying this KeepCozy seed.';
  end if;

  insert into public.rooms (
    space_id,
    slug,
    name,
    summary,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_test_space_id,
    'kitchen',
    'Kitchen',
    'Daily-use systems, water, and appliance follow-through.',
    v_actor_id,
    timestamptz '2026-04-07 09:00:00+00',
    timestamptz '2026-04-07 09:00:00+00'
  )
  on conflict (space_id, slug) do nothing;

  select rooms.id
  into v_room_id
  from public.rooms as rooms
  where rooms.space_id = v_test_space_id
    and rooms.slug = 'kitchen'
  limit 1;

  insert into public.issues (
    space_id,
    room_id,
    slug,
    title,
    summary,
    status,
    next_step,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_test_space_id,
    v_room_id,
    'kitchen-faucet-drip',
    'Kitchen faucet keeps dripping after shutoff',
    'The sink faucet drips for a while after use, which makes this a clear issue-to-task case.',
    'in_review',
    'Identify the faucet model so the task list can stay specific and small.',
    v_actor_id,
    timestamptz '2026-04-07 09:15:00+00',
    timestamptz '2026-04-07 09:42:00+00'
  )
  on conflict (space_id, slug) do nothing;

  select issues.id
  into v_issue_id
  from public.issues as issues
  where issues.space_id = v_test_space_id
    and issues.slug = 'kitchen-faucet-drip'
  limit 1;

  insert into public.tasks (
    space_id,
    issue_id,
    slug,
    title,
    summary,
    status,
    next_step,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_test_space_id,
    v_issue_id,
    'capture-faucet-model',
    'Capture faucet model and cartridge type',
    'Take the smallest possible step that keeps the repair path specific.',
    'waiting',
    'Add one update with the model details before creating any supplier-heavy flow.',
    v_actor_id,
    timestamptz '2026-04-07 09:44:00+00',
    timestamptz '2026-04-07 09:49:00+00'
  )
  on conflict (space_id, slug) do nothing;

  select tasks.id
  into v_task_id
  from public.tasks as tasks
  where tasks.space_id = v_test_space_id
    and tasks.slug = 'capture-faucet-model'
  limit 1;

  insert into public.issue_updates (
    space_id,
    issue_id,
    label,
    body,
    kind,
    created_by,
    created_at
  )
  select
    v_test_space_id,
    v_issue_id,
    'Issue logged',
    'A slow drip continues after the handle is fully closed.',
    'note',
    v_actor_id,
    timestamptz '2026-04-07 09:15:00+00'
  where not exists (
    select 1
    from public.issue_updates
    where issue_id = v_issue_id
      and label = 'Issue logged'
      and body = 'A slow drip continues after the handle is fully closed.'
  );

  insert into public.issue_updates (
    space_id,
    issue_id,
    label,
    body,
    kind,
    created_by,
    created_at
  )
  select
    v_test_space_id,
    v_issue_id,
    'Initial assessment',
    'Looks like a cartridge or washer path, so the first task should narrow the fixture details.',
    'note',
    v_actor_id,
    timestamptz '2026-04-07 09:42:00+00'
  where not exists (
    select 1
    from public.issue_updates
    where issue_id = v_issue_id
      and label = 'Initial assessment'
      and body = 'Looks like a cartridge or washer path, so the first task should narrow the fixture details.'
  );

  insert into public.task_updates (
    space_id,
    task_id,
    label,
    body,
    kind,
    created_by,
    created_at
  )
  select
    v_test_space_id,
    v_task_id,
    'Task created',
    'The issue should stay narrow until the fixture is identified.',
    'note',
    v_actor_id,
    timestamptz '2026-04-07 09:44:00+00'
  where not exists (
    select 1
    from public.task_updates
    where task_id = v_task_id
      and label = 'Task created'
      and body = 'The issue should stay narrow until the fixture is identified.'
  );

  insert into public.task_updates (
    space_id,
    task_id,
    label,
    body,
    kind,
    created_by,
    created_at
  )
  select
    v_test_space_id,
    v_task_id,
    'Scope held',
    'Do not jump to ordering or vendor steps yet. The MVP loop only needs clean history.',
    'note',
    v_actor_id,
    timestamptz '2026-04-07 09:49:00+00'
  where not exists (
    select 1
    from public.task_updates
    where task_id = v_task_id
      and label = 'Scope held'
      and body = 'Do not jump to ordering or vendor steps yet. The MVP loop only needs clean history.'
  );
end $$;

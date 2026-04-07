import 'server-only';

import {
  getRequestSupabaseServerClient,
  requireRequestViewer,
} from '@/lib/request-context/server';

export const KEEP_COZY_ISSUE_STATUS_VALUES = [
  'open',
  'planned',
  'in_review',
  'resolved',
] as const;

export type KeepCozyIssueStatusCode =
  (typeof KEEP_COZY_ISSUE_STATUS_VALUES)[number];

export const KEEP_COZY_TASK_STATUS_VALUES = [
  'planned',
  'active',
  'waiting',
  'done',
  'cancelled',
] as const;

export type KeepCozyTaskStatusCode =
  (typeof KEEP_COZY_TASK_STATUS_VALUES)[number];

type KeepCozyWriteRoomRow = {
  id: string;
  slug: string;
  name: string;
};

type KeepCozyWriteIssueRow = {
  id: string;
  slug: string;
  room_id: string | null;
  status: KeepCozyIssueStatusCode;
  resolved_at: string | null;
  resolved_by: string | null;
  updated_at: string | null;
};

type KeepCozyWriteTaskRow = {
  id: string;
  slug: string;
  issue_id: string;
  status: KeepCozyTaskStatusCode;
  completed_at: string | null;
  completed_by: string | null;
  updated_at: string | null;
};

function trimToNullable(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized : null;
}

function slugifyKeepCozyValue(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || 'issue';
}

export function normalizeKeepCozyIssueStatus(
  value: string | null | undefined,
): KeepCozyIssueStatusCode | null {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return null;
  }

  return KEEP_COZY_ISSUE_STATUS_VALUES.includes(
    normalized as KeepCozyIssueStatusCode,
  )
    ? (normalized as KeepCozyIssueStatusCode)
    : null;
}

export function normalizeKeepCozyTaskStatus(
  value: string | null | undefined,
): KeepCozyTaskStatusCode | null {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return null;
  }

  return KEEP_COZY_TASK_STATUS_VALUES.includes(
    normalized as KeepCozyTaskStatusCode,
  )
    ? (normalized as KeepCozyTaskStatusCode)
    : null;
}

async function findKeepCozyRoomBySlug(input: {
  spaceId: string;
  roomSlug: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const { data, error } = await supabase
    .from('rooms')
    .select('id, slug, name')
    .eq('space_id', input.spaceId)
    .eq('slug', input.roomSlug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as KeepCozyWriteRoomRow | null;
}

async function findKeepCozyRoomByRecordId(input: {
  roomId: string;
  spaceId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const { data, error } = await supabase
    .from('rooms')
    .select('id, slug, name')
    .eq('space_id', input.spaceId)
    .eq('id', input.roomId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as KeepCozyWriteRoomRow | null;
}

async function findKeepCozyIssueBySlug(input: {
  spaceId: string;
  issueSlug: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const { data, error } = await supabase
    .from('issues')
    .select('id, slug, room_id, status, resolved_at, resolved_by, updated_at')
    .eq('space_id', input.spaceId)
    .eq('slug', input.issueSlug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as KeepCozyWriteIssueRow | null;
}

async function findKeepCozyIssueByRecordId(input: {
  issueId: string;
  spaceId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const { data, error } = await supabase
    .from('issues')
    .select('id, slug, room_id, status, resolved_at, resolved_by, updated_at')
    .eq('space_id', input.spaceId)
    .eq('id', input.issueId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as KeepCozyWriteIssueRow | null;
}

async function findKeepCozyTaskBySlug(input: {
  spaceId: string;
  taskSlug: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, slug, issue_id, status, completed_at, completed_by, updated_at')
    .eq('space_id', input.spaceId)
    .eq('slug', input.taskSlug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as KeepCozyWriteTaskRow | null;
}

async function createUniqueKeepCozyIssueSlug(input: {
  spaceId: string;
  title: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const baseSlug = slugifyKeepCozyValue(input.title);
  let attempt = 1;

  while (attempt < 100) {
    const candidate = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    const { data, error } = await supabase
      .from('issues')
      .select('slug')
      .eq('space_id', input.spaceId)
      .eq('slug', candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return candidate;
    }

    attempt += 1;
  }

  throw new Error('Unable to create a unique issue slug right now.');
}

async function createUniqueKeepCozyTaskSlug(input: {
  spaceId: string;
  title: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const baseSlug = slugifyKeepCozyValue(input.title);
  let attempt = 1;

  while (attempt < 100) {
    const candidate = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    const { data, error } = await supabase
      .from('tasks')
      .select('slug')
      .eq('space_id', input.spaceId)
      .eq('slug', candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return candidate;
    }

    attempt += 1;
  }

  throw new Error('Unable to create a unique task slug right now.');
}

export async function createKeepCozyIssue(input: {
  firstUpdateBody: string;
  firstUpdateLabel: string;
  nextStep?: string | null;
  roomSlug?: string | null;
  spaceId: string;
  summary?: string | null;
  title: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const user = await requireRequestViewer('keepcozy:create-issue');
  const title = trimToNullable(input.title);
  const firstUpdateBody = trimToNullable(input.firstUpdateBody);
  const firstUpdateLabel = trimToNullable(input.firstUpdateLabel);

  if (!input.spaceId?.trim()) {
    throw new Error('Active home is required before creating an issue.');
  }

  if (!title) {
    throw new Error('Issue title is required.');
  }

  if (!firstUpdateBody) {
    throw new Error('The first issue update is required.');
  }

  if (!firstUpdateLabel) {
    throw new Error('The first issue update label is required.');
  }

  const normalizedRoomSlug = trimToNullable(input.roomSlug);
  const room = normalizedRoomSlug
    ? await findKeepCozyRoomBySlug({
        roomSlug: normalizedRoomSlug,
        spaceId: input.spaceId,
      })
    : null;

  if (normalizedRoomSlug && !room) {
    throw new Error('The selected room could not be found in this home.');
  }

  const issueSlug = await createUniqueKeepCozyIssueSlug({
    spaceId: input.spaceId,
    title,
  });
  const now = new Date().toISOString();
  const { data: createdIssue, error: createIssueError } = await supabase
    .from('issues')
    .insert({
      created_by: user.id,
      next_step: trimToNullable(input.nextStep),
      room_id: room?.id ?? null,
      slug: issueSlug,
      space_id: input.spaceId,
      status: 'open' satisfies KeepCozyIssueStatusCode,
      summary: trimToNullable(input.summary),
      title,
      updated_at: now,
    })
    .select('id, slug')
    .single();

  if (createIssueError || !createdIssue?.id) {
    throw new Error(createIssueError?.message ?? 'Unable to create the issue.');
  }

  const { error: createUpdateError } = await supabase.from('issue_updates').insert({
    body: firstUpdateBody,
    created_by: user.id,
    issue_id: createdIssue.id,
    kind: 'note',
    label: firstUpdateLabel,
    space_id: input.spaceId,
  });

  if (createUpdateError) {
    throw new Error(createUpdateError.message);
  }

  return {
    issueSlug: createdIssue.slug,
    roomSlug: room?.slug ?? null,
  };
}

export async function appendKeepCozyIssueUpdate(input: {
  body: string;
  label?: string | null;
  noteLabelFallback: string;
  requestedStatus?: KeepCozyIssueStatusCode | null;
  resolutionLabelFallback: string;
  spaceId: string;
  statusChangeLabelFallback: string;
  issueSlug: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const user = await requireRequestViewer('keepcozy:append-issue-update');
  const issueSlug = trimToNullable(input.issueSlug);
  const body = trimToNullable(input.body);

  if (!input.spaceId?.trim()) {
    throw new Error('Active home is required before saving an issue update.');
  }

  if (!issueSlug) {
    throw new Error('Issue selection is required.');
  }

  if (!body) {
    throw new Error('Issue update text is required.');
  }

  const issue = await findKeepCozyIssueBySlug({
    issueSlug,
    spaceId: input.spaceId,
  });

  if (!issue) {
    throw new Error('The selected issue could not be found in this home.');
  }

  const room = issue.room_id
    ? await findKeepCozyRoomByRecordId({
        roomId: issue.room_id,
        spaceId: input.spaceId,
      })
    : null;

  const requestedStatus =
    input.requestedStatus && input.requestedStatus !== issue.status
      ? input.requestedStatus
      : null;

  if (!requestedStatus) {
    const { error } = await supabase.from('issue_updates').insert({
      body,
      created_by: user.id,
      issue_id: issue.id,
      kind: 'note',
      label: trimToNullable(input.label) ?? input.noteLabelFallback,
      space_id: input.spaceId,
    });

    if (error) {
      throw new Error(error.message);
    }

    const { error: touchIssueError } = await supabase
      .from('issues')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('space_id', input.spaceId)
      .eq('id', issue.id);

    if (touchIssueError && !touchIssueError.message.toLowerCase().includes('row-level security')) {
      throw new Error(touchIssueError.message);
    }

    return {
      issueSlug: issue.slug,
      roomSlug: room?.slug ?? null,
      updateKind: 'note' as const,
    };
  }

  const now = new Date().toISOString();
  const previousIssueState = {
    resolved_at: issue.resolved_at,
    resolved_by: issue.resolved_by,
    status: issue.status,
    updated_at: issue.updated_at,
  };
  const nextIssueState = {
    resolved_at: requestedStatus === 'resolved' ? now : null,
    resolved_by: requestedStatus === 'resolved' ? user.id : null,
    status: requestedStatus,
    updated_at: now,
  };
  const { error: updateIssueError } = await supabase
    .from('issues')
    .update(nextIssueState)
    .eq('space_id', input.spaceId)
    .eq('id', issue.id);

  if (updateIssueError) {
    throw new Error(updateIssueError.message);
  }

  const { error: insertUpdateError } = await supabase.from('issue_updates').insert({
    body,
    created_by: user.id,
    issue_id: issue.id,
    kind: requestedStatus === 'resolved' ? 'resolution' : 'status_change',
    label:
      trimToNullable(input.label) ??
      (requestedStatus === 'resolved'
        ? input.resolutionLabelFallback
        : input.statusChangeLabelFallback),
    space_id: input.spaceId,
    status_after: requestedStatus,
  });

  if (insertUpdateError) {
    await supabase
      .from('issues')
      .update({
        resolved_at: previousIssueState.resolved_at,
        resolved_by: previousIssueState.resolved_by,
        status: previousIssueState.status,
        updated_at: previousIssueState.updated_at ?? now,
      })
      .eq('space_id', input.spaceId)
      .eq('id', issue.id);

    throw new Error(insertUpdateError.message);
  }

  return {
    issueSlug: issue.slug,
    roomSlug: room?.slug ?? null,
    updateKind: requestedStatus === 'resolved' ? ('resolution' as const) : ('status_change' as const),
  };
}

export async function createKeepCozyTask(input: {
  firstUpdateBody: string;
  firstUpdateLabel: string;
  issueSlug: string;
  nextStep?: string | null;
  spaceId: string;
  summary?: string | null;
  title: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const user = await requireRequestViewer('keepcozy:create-task');
  const issueSlug = trimToNullable(input.issueSlug);
  const title = trimToNullable(input.title);
  const firstUpdateBody = trimToNullable(input.firstUpdateBody);
  const firstUpdateLabel = trimToNullable(input.firstUpdateLabel);

  if (!input.spaceId?.trim()) {
    throw new Error('Active home is required before creating a task.');
  }

  if (!issueSlug) {
    throw new Error('Issue selection is required before creating a task.');
  }

  if (!title) {
    throw new Error('Task title is required.');
  }

  if (!firstUpdateBody) {
    throw new Error('The first task update is required.');
  }

  if (!firstUpdateLabel) {
    throw new Error('The first task update label is required.');
  }

  const issue = await findKeepCozyIssueBySlug({
    issueSlug,
    spaceId: input.spaceId,
  });

  if (!issue) {
    throw new Error('The selected issue could not be found in this home.');
  }

  const room = issue.room_id
    ? await findKeepCozyRoomByRecordId({
        roomId: issue.room_id,
        spaceId: input.spaceId,
      })
    : null;
  const taskSlug = await createUniqueKeepCozyTaskSlug({
    spaceId: input.spaceId,
    title,
  });
  const now = new Date().toISOString();
  const { data: createdTask, error: createTaskError } = await supabase
    .from('tasks')
    .insert({
      created_by: user.id,
      issue_id: issue.id,
      next_step: trimToNullable(input.nextStep),
      slug: taskSlug,
      space_id: input.spaceId,
      status: 'planned' satisfies KeepCozyTaskStatusCode,
      summary: trimToNullable(input.summary),
      title,
      updated_at: now,
    })
    .select('id, slug')
    .single();

  if (createTaskError || !createdTask?.id) {
    throw new Error(createTaskError?.message ?? 'Unable to create the task.');
  }

  const { error: createUpdateError } = await supabase.from('task_updates').insert({
    body: firstUpdateBody,
    created_by: user.id,
    kind: 'note',
    label: firstUpdateLabel,
    space_id: input.spaceId,
    task_id: createdTask.id,
  });

  if (createUpdateError) {
    throw new Error(createUpdateError.message);
  }

  return {
    issueSlug: issue.slug,
    roomSlug: room?.slug ?? null,
    taskSlug: createdTask.slug,
  };
}

export async function appendKeepCozyTaskUpdate(input: {
  body: string;
  label?: string | null;
  noteLabelFallback: string;
  requestedStatus?: KeepCozyTaskStatusCode | null;
  completionLabelFallback: string;
  spaceId: string;
  statusChangeLabelFallback: string;
  taskSlug: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const user = await requireRequestViewer('keepcozy:append-task-update');
  const taskSlug = trimToNullable(input.taskSlug);
  const body = trimToNullable(input.body);

  if (!input.spaceId?.trim()) {
    throw new Error('Active home is required before saving a task update.');
  }

  if (!taskSlug) {
    throw new Error('Task selection is required.');
  }

  if (!body) {
    throw new Error('Task update text is required.');
  }

  const task = await findKeepCozyTaskBySlug({
    spaceId: input.spaceId,
    taskSlug,
  });

  if (!task) {
    throw new Error('The selected task could not be found in this home.');
  }

  const issue = await findKeepCozyIssueByRecordId({
    issueId: task.issue_id,
    spaceId: input.spaceId,
  });

  if (!issue) {
    throw new Error('The linked issue could not be found in this home.');
  }

  const room = issue.room_id
    ? await findKeepCozyRoomByRecordId({
        roomId: issue.room_id,
        spaceId: input.spaceId,
      })
    : null;
  const requestedStatus =
    input.requestedStatus && input.requestedStatus !== task.status
      ? input.requestedStatus
      : null;

  if (!requestedStatus) {
    const { error } = await supabase.from('task_updates').insert({
      body,
      created_by: user.id,
      kind: 'note',
      label: trimToNullable(input.label) ?? input.noteLabelFallback,
      space_id: input.spaceId,
      task_id: task.id,
    });

    if (error) {
      throw new Error(error.message);
    }

    const { error: touchTaskError } = await supabase
      .from('tasks')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('space_id', input.spaceId)
      .eq('id', task.id);

    if (touchTaskError && !touchTaskError.message.toLowerCase().includes('row-level security')) {
      throw new Error(touchTaskError.message);
    }

    return {
      issueSlug: issue.slug,
      roomSlug: room?.slug ?? null,
      taskSlug: task.slug,
      updateKind: 'note' as const,
    };
  }

  const now = new Date().toISOString();
  const previousTaskState = {
    completed_at: task.completed_at,
    completed_by: task.completed_by,
    status: task.status,
    updated_at: task.updated_at,
  };
  const nextTaskState = {
    completed_at: requestedStatus === 'done' ? now : null,
    completed_by: requestedStatus === 'done' ? user.id : null,
    status: requestedStatus,
    updated_at: now,
  };
  const { error: updateTaskError } = await supabase
    .from('tasks')
    .update(nextTaskState)
    .eq('space_id', input.spaceId)
    .eq('id', task.id);

  if (updateTaskError) {
    throw new Error(updateTaskError.message);
  }

  const { error: insertUpdateError } = await supabase.from('task_updates').insert({
    body,
    created_by: user.id,
    kind: requestedStatus === 'done' ? 'completion' : 'status_change',
    label:
      trimToNullable(input.label) ??
      (requestedStatus === 'done'
        ? input.completionLabelFallback
        : input.statusChangeLabelFallback),
    space_id: input.spaceId,
    status_after: requestedStatus,
    task_id: task.id,
  });

  if (insertUpdateError) {
    await supabase
      .from('tasks')
      .update({
        completed_at: previousTaskState.completed_at,
        completed_by: previousTaskState.completed_by,
        status: previousTaskState.status,
        updated_at: previousTaskState.updated_at ?? now,
      })
      .eq('space_id', input.spaceId)
      .eq('id', task.id);

    throw new Error(insertUpdateError.message);
  }

  return {
    issueSlug: issue.slug,
    roomSlug: room?.slug ?? null,
    taskSlug: task.slug,
    updateKind: requestedStatus === 'done' ? ('completion' as const) : ('status_change' as const),
  };
}

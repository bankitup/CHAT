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
    ? await (async () => {
        const client = await getRequestSupabaseServerClient();
        const { data, error } = await client
          .from('rooms')
          .select('id, slug, name')
          .eq('space_id', input.spaceId)
          .eq('id', issue.room_id)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return (data ?? null) as KeepCozyWriteRoomRow | null;
      })()
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
  };
}

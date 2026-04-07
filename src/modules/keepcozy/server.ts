import 'server-only';

import { redirect } from 'next/navigation';
import { getRequestSupabaseServerClient } from '@/lib/request-context/server';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getKeepCozyPreview,
  getKeepCozyPrimaryTestFlow,
} from '@/modules/keepcozy/mvp-preview';
import {
  isSpaceMembersSchemaCacheErrorMessage,
  resolveActiveSpaceForUser,
  resolveV1TestSpaceFallback,
} from '@/modules/spaces/server';

type ResolveKeepCozyContextInput = {
  requestedSpaceId?: string | null;
  source: string;
};

type KeepCozyRoomRow = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type KeepCozyIssueRow = {
  id: string;
  room_id: string | null;
  slug: string;
  title: string;
  summary: string | null;
  status: string;
  next_step: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type KeepCozyIssueUpdateRow = {
  id: string;
  issue_id: string;
  label: string;
  body: string;
  kind: string;
  status_after: string | null;
  created_at: string | null;
};

type KeepCozyTaskRow = {
  id: string;
  issue_id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: string;
  next_step: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type KeepCozyTaskUpdateRow = {
  id: string;
  task_id: string;
  label: string;
  body: string;
  kind: string;
  status_after: string | null;
  created_at: string | null;
};

export type KeepCozyRuntimeSource = 'persisted' | 'preview-fallback';

export type KeepCozyRuntimeUpdate = {
  id: string;
  recordId: string | null;
  label: string;
  note: string;
  timestamp: string;
  createdAt: string | null;
  kind: string;
  statusAfter: string | null;
};

export type KeepCozyRuntimeRoom = {
  id: string;
  recordId: string | null;
  name: string;
  summary: string;
  issueCount: number;
  taskCount: number;
};

export type KeepCozyRuntimeIssue = {
  id: string;
  recordId: string | null;
  roomId: string | null;
  roomName: string | null;
  title: string;
  summary: string;
  status: string;
  nextStep: string | null;
  taskCount: number;
  updates: KeepCozyRuntimeUpdate[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type KeepCozyRuntimeTask = {
  id: string;
  recordId: string | null;
  issueId: string | null;
  issueTitle: string | null;
  roomId: string | null;
  roomName: string | null;
  title: string;
  summary: string;
  status: string;
  nextStep: string | null;
  updates: KeepCozyRuntimeUpdate[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type KeepCozyRuntimeActivityEntry = KeepCozyRuntimeUpdate & {
  href: {
    kind: 'issue' | 'task';
    targetId: string;
  };
  stage: 'issue' | 'task';
};

export type KeepCozyPrimaryFlowData = {
  homeNameHint: string;
  room: KeepCozyRuntimeRoom;
  issue: KeepCozyRuntimeIssue;
  task: KeepCozyRuntimeTask;
  history: KeepCozyRuntimeActivityEntry[];
};

type KeepCozySpaceSnapshot = {
  source: KeepCozyRuntimeSource;
  rooms: KeepCozyRuntimeRoom[];
  issues: KeepCozyRuntimeIssue[];
  tasks: KeepCozyRuntimeTask[];
  counts: {
    rooms: number;
    issues: number;
    tasks: number;
    history: number;
    issueUpdates: number;
    taskUpdates: number;
    resolutionNotes: number;
  };
  primaryFlow: KeepCozyPrimaryFlowData | null;
};

const KEEP_COZY_PRIMARY_TEST_FLOW = {
  homeNameHint: 'TEST',
  issueId: 'kitchen-faucet-drip',
  roomId: 'kitchen',
  taskId: 'capture-faucet-model',
} as const;

export function isKeepCozyPrimaryTestHomeName(
  name: string | null | undefined,
) {
  return (
    (name ?? '').trim().toUpperCase() === KEEP_COZY_PRIMARY_TEST_FLOW.homeNameHint
  );
}

function getKeepCozyLocale(language: AppLanguage) {
  return language === 'ru' ? 'ru-RU' : 'en-US';
}

function formatKeepCozyTimestamp(
  language: AppLanguage,
  value: string | null | undefined,
) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(getKeepCozyLocale(language), {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(parsed);
}

function getKeepCozyIssueStatusLabel(
  language: AppLanguage,
  status: string,
) {
  const labels =
    language === 'ru'
      ? {
          in_review: 'На разборе',
          open: 'Требует внимания',
          planned: 'Запланировано',
          resolved: 'Решено',
        }
      : {
          in_review: 'In review',
          open: 'Needs attention',
          planned: 'Planned',
          resolved: 'Resolved',
        };

  return labels[status as keyof typeof labels] ?? status;
}

function getKeepCozyTaskStatusLabel(
  language: AppLanguage,
  status: string,
) {
  const labels =
    language === 'ru'
      ? {
          active: 'Активна',
          cancelled: 'Отменена',
          done: 'Завершена',
          planned: 'Запланирована',
          waiting: 'Ожидание',
        }
      : {
          active: 'Active',
          cancelled: 'Cancelled',
          done: 'Done',
          planned: 'Planned',
          waiting: 'Waiting',
        };

  return labels[status as keyof typeof labels] ?? status;
}

function isKeepCozyPersistenceUnavailableErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  const touchesKeepCozyTables = [
    'rooms',
    'issues',
    'issue_updates',
    'tasks',
    'task_updates',
  ].some((table) => normalized.includes(table));

  if (!touchesKeepCozyTables) {
    return false;
  }

  return (
    normalized.includes('schema cache') ||
    normalized.includes('relation') ||
    normalized.includes('could not find the table') ||
    normalized.includes('does not exist')
  );
}

function createRuntimeUpdate(input: {
  createdAt: string | null;
  id: string;
  kind: string;
  label: string;
  note: string;
  recordId?: string | null;
  statusAfter?: string | null;
  language: AppLanguage;
}): KeepCozyRuntimeUpdate {
  return {
    createdAt: input.createdAt,
    id: input.id,
    kind: input.kind,
    label: input.label,
    note: input.note,
    recordId: input.recordId ?? null,
    statusAfter: input.statusAfter ?? null,
    timestamp: formatKeepCozyTimestamp(input.language, input.createdAt),
  };
}

function buildPrimaryFlow(input: {
  issues: KeepCozyRuntimeIssue[];
  tasks: KeepCozyRuntimeTask[];
  rooms: KeepCozyRuntimeRoom[];
}): KeepCozyPrimaryFlowData | null {
  const room =
    input.rooms.find((candidate) => candidate.id === KEEP_COZY_PRIMARY_TEST_FLOW.roomId) ??
    null;
  const issue =
    input.issues.find((candidate) => candidate.id === KEEP_COZY_PRIMARY_TEST_FLOW.issueId) ??
    null;
  const task =
    input.tasks.find((candidate) => candidate.id === KEEP_COZY_PRIMARY_TEST_FLOW.taskId) ??
    null;

  if (!room || !issue || !task) {
    return null;
  }

  const history = [
    ...issue.updates.map((update) => ({
      ...update,
      href: {
        kind: 'issue' as const,
        targetId: issue.id,
      },
      stage: 'issue' as const,
    })),
    ...task.updates.map((update) => ({
      ...update,
      href: {
        kind: 'task' as const,
        targetId: task.id,
      },
      stage: 'task' as const,
    })),
  ].sort((left, right) => {
    const leftValue = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightValue = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return leftValue - rightValue;
  });

  return {
    history,
    homeNameHint: KEEP_COZY_PRIMARY_TEST_FLOW.homeNameHint,
    issue,
    room,
    task,
  };
}

function buildPreviewFallbackSnapshot(
  language: AppLanguage,
): KeepCozySpaceSnapshot {
  const preview = getKeepCozyPreview(language);
  const primaryFlow = getKeepCozyPrimaryTestFlow(language);
  const issuesById = new Map(preview.issues.map((issue) => [issue.id, issue]));
  const tasksByIssueId = preview.tasks.reduce(
    (map, task) => {
      const existing = map.get(task.issueId) ?? 0;
      map.set(task.issueId, existing + 1);
      return map;
    },
    new Map<string, number>(),
  );

  const rooms = preview.rooms.map((room) => {
    const roomIssues = preview.issues.filter((issue) => issue.roomId === room.id);
    const taskCount = preview.tasks.filter((task) => {
      const issue = issuesById.get(task.issueId);
      return issue?.roomId === room.id;
    }).length;

    return {
      id: room.id,
      issueCount: roomIssues.length,
      name: room.name,
      recordId: null,
      summary: room.summary,
      taskCount,
    } satisfies KeepCozyRuntimeRoom;
  });

  const issues = preview.issues.map((issue) => {
    const room = preview.rooms.find((candidate) => candidate.id === issue.roomId) ?? null;

    return {
      createdAt: null,
      id: issue.id,
      nextStep: issue.nextStep,
      recordId: null,
      roomId: room?.id ?? null,
      roomName: room?.name ?? null,
      status: issue.status,
      summary: issue.summary,
      taskCount: tasksByIssueId.get(issue.id) ?? 0,
      title: issue.title,
      updatedAt: null,
      updates: issue.updates.map((update) =>
        createRuntimeUpdate({
          createdAt: update.timestamp,
          id: update.id,
          kind: 'note',
          label: update.label,
          language,
          note: update.note,
        }),
      ),
    } satisfies KeepCozyRuntimeIssue;
  });

  const tasks = preview.tasks.map((task) => {
    const issue = issuesById.get(task.issueId) ?? null;
    const room =
      issue ? preview.rooms.find((candidate) => candidate.id === issue.roomId) ?? null : null;

    return {
      createdAt: null,
      id: task.id,
      issueId: issue?.id ?? null,
      issueTitle: issue?.title ?? null,
      nextStep: task.nextStep,
      recordId: null,
      roomId: room?.id ?? null,
      roomName: room?.name ?? null,
      status: task.status,
      summary: task.summary,
      title: task.title,
      updatedAt: null,
      updates: task.updates.map((update) =>
        createRuntimeUpdate({
          createdAt: update.timestamp,
          id: update.id,
          kind: 'note',
          label: update.label,
          language,
          note: update.note,
        }),
      ),
    } satisfies KeepCozyRuntimeTask;
  });

  return {
    counts: {
      history:
        preview.issues.reduce((count, issue) => count + issue.updates.length, 0) +
        preview.tasks.reduce((count, task) => count + task.updates.length, 0),
      issueUpdates: preview.issues.reduce((count, issue) => count + issue.updates.length, 0),
      issues: issues.length,
      resolutionNotes: 0,
      rooms: rooms.length,
      taskUpdates: preview.tasks.reduce((count, task) => count + task.updates.length, 0),
      tasks: tasks.length,
    },
    issues,
    primaryFlow: {
      history: primaryFlow.history.map((entry) => ({
        ...createRuntimeUpdate({
          createdAt: entry.timestamp,
          id: entry.id,
          kind: 'note',
          label: entry.label,
          language,
          note: entry.note,
        }),
        href: entry.href,
        stage: entry.stage,
      })),
      homeNameHint: primaryFlow.homeNameHint,
      issue: issues.find((issue) => issue.id === primaryFlow.issue.id) ?? issues[0]!,
      room: rooms.find((room) => room.id === primaryFlow.room.id) ?? rooms[0]!,
      task: tasks.find((task) => task.id === primaryFlow.task.id) ?? tasks[0]!,
    },
    rooms,
    source: 'preview-fallback',
    tasks,
  };
}

async function requireKeepCozyTableData(input: {
  spaceId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const [roomsResponse, issuesResponse, issueUpdatesResponse, tasksResponse, taskUpdatesResponse] =
    await Promise.all([
      supabase
        .from('rooms')
        .select('id, slug, name, summary, created_at, updated_at')
        .eq('space_id', input.spaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('issues')
        .select('id, room_id, slug, title, summary, status, next_step, created_at, updated_at')
        .eq('space_id', input.spaceId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('issue_updates')
        .select('id, issue_id, label, body, kind, status_after, created_at')
        .eq('space_id', input.spaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('tasks')
        .select('id, issue_id, slug, title, summary, status, next_step, created_at, updated_at')
        .eq('space_id', input.spaceId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('task_updates')
        .select('id, task_id, label, body, kind, status_after, created_at')
        .eq('space_id', input.spaceId)
        .order('created_at', { ascending: true }),
    ]);

  if (roomsResponse.error) {
    throw new Error(`[keepcozy:rooms] ${roomsResponse.error.message}`);
  }

  if (issuesResponse.error) {
    throw new Error(`[keepcozy:issues] ${issuesResponse.error.message}`);
  }

  if (issueUpdatesResponse.error) {
    throw new Error(`[keepcozy:issue_updates] ${issueUpdatesResponse.error.message}`);
  }

  if (tasksResponse.error) {
    throw new Error(`[keepcozy:tasks] ${tasksResponse.error.message}`);
  }

  if (taskUpdatesResponse.error) {
    throw new Error(`[keepcozy:task_updates] ${taskUpdatesResponse.error.message}`);
  }

  return {
    issueUpdates: (issueUpdatesResponse.data ?? []) as KeepCozyIssueUpdateRow[],
    issues: (issuesResponse.data ?? []) as KeepCozyIssueRow[],
    rooms: (roomsResponse.data ?? []) as KeepCozyRoomRow[],
    taskUpdates: (taskUpdatesResponse.data ?? []) as KeepCozyTaskUpdateRow[],
    tasks: (tasksResponse.data ?? []) as KeepCozyTaskRow[],
  };
}

async function getKeepCozySpaceSnapshot(
  spaceId: string,
  language: AppLanguage,
): Promise<KeepCozySpaceSnapshot> {
  try {
    const { issueUpdates, issues, rooms, taskUpdates, tasks } =
      await requireKeepCozyTableData({
        spaceId,
      });
      const roomByRecordId = new Map(rooms.map((room) => [room.id, room]));
      const issueByRecordId = new Map(issues.map((issue) => [issue.id, issue]));
      const taskCountByIssueId = tasks.reduce(
        (map, task) => {
          const existing = map.get(task.issue_id) ?? 0;
          map.set(task.issue_id, existing + 1);
          return map;
        },
        new Map<string, number>(),
      );
      const issueCountByRoomId = issues.reduce(
        (map, issue) => {
          if (!issue.room_id) {
            return map;
          }

          const existing = map.get(issue.room_id) ?? 0;
          map.set(issue.room_id, existing + 1);
          return map;
        },
        new Map<string, number>(),
      );
      const taskCountByRoomId = tasks.reduce(
        (map, task) => {
          const issue = issueByRecordId.get(task.issue_id);

          if (!issue?.room_id) {
            return map;
          }

          const existing = map.get(issue.room_id) ?? 0;
          map.set(issue.room_id, existing + 1);
          return map;
        },
        new Map<string, number>(),
      );
      const issueUpdatesByIssueId = issueUpdates.reduce(
        (map, update) => {
          const existing = map.get(update.issue_id) ?? [];
          existing.push(
            createRuntimeUpdate({
              createdAt: update.created_at,
              id: update.id,
              kind: update.kind,
              label: update.label,
              language,
              note: update.body,
              recordId: update.id,
              statusAfter: update.status_after,
            }),
          );
          map.set(update.issue_id, existing);
          return map;
        },
        new Map<string, KeepCozyRuntimeUpdate[]>(),
      );
      const taskUpdatesByTaskId = taskUpdates.reduce(
        (map, update) => {
          const existing = map.get(update.task_id) ?? [];
          existing.push(
            createRuntimeUpdate({
              createdAt: update.created_at,
              id: update.id,
              kind: update.kind,
              label: update.label,
              language,
              note: update.body,
              recordId: update.id,
              statusAfter: update.status_after,
            }),
          );
          map.set(update.task_id, existing);
          return map;
        },
        new Map<string, KeepCozyRuntimeUpdate[]>(),
      );

      const runtimeRooms = rooms.map((room) => ({
        id: room.slug,
        issueCount: issueCountByRoomId.get(room.id) ?? 0,
        name: room.name,
        recordId: room.id,
        summary: room.summary ?? '',
        taskCount: taskCountByRoomId.get(room.id) ?? 0,
      })) satisfies KeepCozyRuntimeRoom[];

      const runtimeIssues = issues.map((issue) => {
        const room = issue.room_id ? roomByRecordId.get(issue.room_id) ?? null : null;

        return {
          createdAt: issue.created_at,
          id: issue.slug,
          nextStep: issue.next_step,
          recordId: issue.id,
          roomId: room?.slug ?? null,
          roomName: room?.name ?? null,
          status: getKeepCozyIssueStatusLabel(language, issue.status),
          summary: issue.summary ?? '',
          taskCount: taskCountByIssueId.get(issue.id) ?? 0,
          title: issue.title,
          updatedAt: issue.updated_at,
          updates: issueUpdatesByIssueId.get(issue.id) ?? [],
        } satisfies KeepCozyRuntimeIssue;
      });
      const runtimeIssueByRecordId = new Map(
        runtimeIssues
          .filter((issue) => issue.recordId)
          .map((issue) => [issue.recordId!, issue]),
      );
      const runtimeTasks = tasks.map((task) => {
        const issue = runtimeIssueByRecordId.get(task.issue_id) ?? null;

        return {
          createdAt: task.created_at,
          id: task.slug,
          issueId: issue?.id ?? null,
          issueTitle: issue?.title ?? null,
          nextStep: task.next_step,
          recordId: task.id,
          roomId: issue?.roomId ?? null,
          roomName: issue?.roomName ?? null,
          status: getKeepCozyTaskStatusLabel(language, task.status),
          summary: task.summary ?? '',
          title: task.title,
          updatedAt: task.updated_at,
          updates: taskUpdatesByTaskId.get(task.id) ?? [],
        } satisfies KeepCozyRuntimeTask;
      });

    return {
      counts: {
        history: issueUpdates.length + taskUpdates.length,
        issueUpdates: issueUpdates.length,
        issues: runtimeIssues.length,
        resolutionNotes:
          issueUpdates.filter((update) => update.kind === 'resolution').length +
          taskUpdates.filter((update) => update.kind === 'completion').length,
        rooms: runtimeRooms.length,
        taskUpdates: taskUpdates.length,
        tasks: runtimeTasks.length,
      },
      issues: runtimeIssues,
      primaryFlow: buildPrimaryFlow({
        issues: runtimeIssues,
        rooms: runtimeRooms,
        tasks: runtimeTasks,
      }),
      rooms: runtimeRooms,
      source: 'persisted',
      tasks: runtimeTasks,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isKeepCozyPersistenceUnavailableErrorMessage(message)) {
      return buildPreviewFallbackSnapshot(language);
    }

    throw error;
  }
}

export async function requireKeepCozyContext(
  input: ResolveKeepCozyContextInput,
) {
  const [user, language] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
  ]);

  if (!user?.id) {
    redirect('/login');
  }

  let activeSpaceId: string | null = null;
  let activeSpaceName: string | null = null;

  const explicitV1TestSpace = await resolveV1TestSpaceFallback({
    requestedSpaceId: input.requestedSpaceId,
    source: `${input.source}-explicit-v1-test-bypass`,
  });

  if (explicitV1TestSpace) {
    activeSpaceId = explicitV1TestSpace.id;
    activeSpaceName = explicitV1TestSpace.name;
  } else {
    try {
      const activeSpaceState = await resolveActiveSpaceForUser({
        requestedSpaceId: input.requestedSpaceId,
        source: input.source,
        userId: user.id,
      });

      if (!activeSpaceState.activeSpace) {
        redirect('/spaces');
      }

      if (activeSpaceState.requestedSpaceWasInvalid) {
        redirect('/spaces');
      }

      activeSpaceId = activeSpaceState.activeSpace.id;
      activeSpaceName = activeSpaceState.activeSpace.name;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (isSpaceMembersSchemaCacheErrorMessage(message)) {
        redirect('/spaces');
      }

      throw error;
    }
  }

  if (!activeSpaceId || !activeSpaceName) {
    redirect('/spaces');
  }

  return {
    activeSpace: {
      id: activeSpaceId,
      name: activeSpaceName,
    },
    language,
    t: getTranslations(language),
    user,
  };
}

export async function getKeepCozyHomeDashboardData(input: {
  language: AppLanguage;
  spaceId: string;
}) {
  const snapshot = await getKeepCozySpaceSnapshot(input.spaceId, input.language);

  return {
    counts: snapshot.counts,
    primaryFlow: snapshot.primaryFlow,
    source: snapshot.source,
  };
}

export async function getKeepCozyRoomsPageData(input: {
  language: AppLanguage;
  spaceId: string;
}) {
  const snapshot = await getKeepCozySpaceSnapshot(input.spaceId, input.language);

  return {
    rooms: snapshot.rooms,
    source: snapshot.source,
  };
}

export async function getKeepCozyRoomDetailData(input: {
  language: AppLanguage;
  roomId: string;
  spaceId: string;
}) {
  const snapshot = await getKeepCozySpaceSnapshot(input.spaceId, input.language);
  const room = snapshot.rooms.find((candidate) => candidate.id === input.roomId) ?? null;

  return {
    room,
    roomIssues: snapshot.issues.filter((issue) => issue.roomId === input.roomId),
    roomTasks: snapshot.tasks.filter((task) => task.roomId === input.roomId),
    source: snapshot.source,
  };
}

export async function getKeepCozyIssuesPageData(input: {
  language: AppLanguage;
  roomId?: string | null;
  spaceId: string;
}) {
  const snapshot = await getKeepCozySpaceSnapshot(input.spaceId, input.language);
  const activeRoom = input.roomId
    ? snapshot.rooms.find((candidate) => candidate.id === input.roomId) ?? null
    : null;

  return {
    activeRoom,
    issues: activeRoom
      ? snapshot.issues.filter((issue) => issue.roomId === activeRoom.id)
      : snapshot.issues,
    source: snapshot.source,
  };
}

export async function getKeepCozyIssueDetailData(input: {
  issueId: string;
  language: AppLanguage;
  spaceId: string;
}) {
  const snapshot = await getKeepCozySpaceSnapshot(input.spaceId, input.language);
  const issue = snapshot.issues.find((candidate) => candidate.id === input.issueId) ?? null;
  const room = issue?.roomId
    ? snapshot.rooms.find((candidate) => candidate.id === issue.roomId) ?? null
    : null;

  return {
    issue,
    room,
    source: snapshot.source,
    tasks: snapshot.tasks.filter((task) => task.issueId === input.issueId),
  };
}

export async function getKeepCozyTasksPageData(input: {
  issueId?: string | null;
  language: AppLanguage;
  roomId?: string | null;
  spaceId: string;
}) {
  const snapshot = await getKeepCozySpaceSnapshot(input.spaceId, input.language);
  const activeIssue = input.issueId
    ? snapshot.issues.find((candidate) => candidate.id === input.issueId) ?? null
    : null;
  const activeRoom =
    !activeIssue && input.roomId
      ? snapshot.rooms.find((candidate) => candidate.id === input.roomId) ?? null
      : null;
  const tasks = activeIssue
    ? snapshot.tasks.filter((task) => task.issueId === activeIssue.id)
    : activeRoom
      ? snapshot.tasks.filter((task) => task.roomId === activeRoom.id)
      : snapshot.tasks;

  return {
    activeIssue,
    activeRoom,
    source: snapshot.source,
    tasks,
  };
}

export async function getKeepCozyTaskDetailData(input: {
  language: AppLanguage;
  spaceId: string;
  taskId: string;
}) {
  const snapshot = await getKeepCozySpaceSnapshot(input.spaceId, input.language);
  const task = snapshot.tasks.find((candidate) => candidate.id === input.taskId) ?? null;
  const issue = task?.issueId
    ? snapshot.issues.find((candidate) => candidate.id === task.issueId) ?? null
    : null;
  const room = task?.roomId
    ? snapshot.rooms.find((candidate) => candidate.id === task.roomId) ?? null
    : null;

  return {
    issue,
    room,
    source: snapshot.source,
    task,
  };
}

export async function getKeepCozyActivityData(input: {
  language: AppLanguage;
  spaceId: string;
}) {
  const snapshot = await getKeepCozySpaceSnapshot(input.spaceId, input.language);

  return {
    counts: snapshot.counts,
    primaryFlow: snapshot.primaryFlow,
    source: snapshot.source,
  };
}

'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  appendKeepCozyTaskUpdate,
  createKeepCozyTask,
  normalizeKeepCozyTaskStatus,
} from '@/modules/keepcozy/write-server';
import {
  logControlledUiError,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import { withSpaceParam } from '@/modules/spaces/url';

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function setTextParam(params: URLSearchParams, key: string, value?: string | null) {
  const normalized = value?.trim() ?? '';

  if (normalized) {
    params.set(key, normalized);
  }
}

function redirectToNewTaskSurface(input: {
  error?: string | null;
  firstUpdateBody?: string | null;
  issueSlug?: string | null;
  message?: string | null;
  nextStep?: string | null;
  spaceId?: string | null;
  summary?: string | null;
  title?: string | null;
}): never {
  const params = new URLSearchParams();

  setTextParam(params, 'issue', input.issueSlug);
  setTextParam(params, 'title', input.title);
  setTextParam(params, 'summary', input.summary);
  setTextParam(params, 'nextStep', input.nextStep);
  setTextParam(params, 'firstUpdateBody', input.firstUpdateBody);
  setTextParam(params, 'error', input.error);
  setTextParam(params, 'message', input.message);

  const href = params.toString() ? `/tasks/new?${params.toString()}` : '/tasks/new';
  redirect(withSpaceParam(href, input.spaceId));
}

function redirectToTaskDetailSurface(input: {
  body?: string | null;
  error?: string | null;
  label?: string | null;
  message?: string | null;
  spaceId?: string | null;
  status?: string | null;
  taskSlug: string;
}): never {
  const params = new URLSearchParams();

  setTextParam(params, 'label', input.label);
  setTextParam(params, 'body', input.body);
  setTextParam(params, 'status', input.status);
  setTextParam(params, 'error', input.error);
  setTextParam(params, 'message', input.message);

  const baseHref = params.toString()
    ? `/tasks/${input.taskSlug}?${params.toString()}`
    : `/tasks/${input.taskSlug}`;

  redirect(withSpaceParam(baseHref, input.spaceId));
}

function getFriendlyKeepCozyTaskErrorMessage(input: {
  error: unknown;
  fallback: string;
  language: AppLanguage;
  surface: string;
}) {
  const rawMessage =
    input.error instanceof Error ? input.error.message : input.fallback;

  logControlledUiError({
    fallback: input.fallback,
    rawMessage,
    surface: input.surface,
  });

  return sanitizeUserFacingErrorMessage({
    fallback: input.fallback,
    language: input.language,
    rawMessage,
  });
}

export async function createTaskAction(formData: FormData) {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const spaceId = readText(formData, 'spaceId');
  const issueSlug = readText(formData, 'issueSlug');
  const title = readText(formData, 'title');
  const summary = readText(formData, 'summary');
  const nextStep = readText(formData, 'nextStep');
  const firstUpdateBody = readText(formData, 'firstUpdateBody');
  const draft = {
    firstUpdateBody,
    issueSlug,
    nextStep,
    summary,
    title,
  };

  if (!issueSlug) {
    redirectToNewTaskSurface({
      error: t.tasks.issueRequired,
      spaceId,
      ...draft,
    });
  }

  if (!title) {
    redirectToNewTaskSurface({
      error: t.tasks.titleRequired,
      spaceId,
      ...draft,
    });
  }

  if (!firstUpdateBody) {
    redirectToNewTaskSurface({
      error: t.tasks.firstUpdateRequired,
      spaceId,
      ...draft,
    });
  }

  try {
    const created = await createKeepCozyTask({
      firstUpdateBody,
      firstUpdateLabel: t.tasks.createdLabel,
      issueSlug,
      nextStep,
      spaceId,
      summary,
      title,
    });

    revalidatePath('/home');
    revalidatePath('/issues');
    revalidatePath('/tasks');
    revalidatePath('/rooms');
    revalidatePath('/activity');
    revalidatePath(`/tasks/${created.taskSlug}`);
    revalidatePath(`/issues/${created.issueSlug}`);

    if (created.roomSlug) {
      revalidatePath(`/rooms/${created.roomSlug}`);
    }

    redirectToTaskDetailSurface({
      message: t.tasks.createSuccess,
      spaceId,
      taskSlug: created.taskSlug,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToNewTaskSurface({
      error: getFriendlyKeepCozyTaskErrorMessage({
        error,
        fallback: t.tasks.createFailed,
        language,
        surface: 'keepcozy:create-task',
      }),
      spaceId,
      ...draft,
    });
  }
}

export async function appendTaskUpdateAction(formData: FormData) {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const spaceId = readText(formData, 'spaceId');
  const taskSlug = readText(formData, 'taskId');
  const label = readText(formData, 'label');
  const body = readText(formData, 'body');
  const requestedStatusRaw = readText(formData, 'status');
  const requestedStatus = normalizeKeepCozyTaskStatus(requestedStatusRaw);
  const draft = {
    body,
    label,
    status: requestedStatusRaw,
  };

  if (requestedStatusRaw && !requestedStatus) {
    redirectToTaskDetailSurface({
      error: t.tasks.statusInvalid,
      spaceId,
      taskSlug,
      ...draft,
    });
  }

  if (!body) {
    redirectToTaskDetailSurface({
      error: t.tasks.updateBodyRequired,
      spaceId,
      taskSlug,
      ...draft,
    });
  }

  try {
    const updated = await appendKeepCozyTaskUpdate({
      body,
      completionLabelFallback: t.tasks.completedLabel,
      label,
      noteLabelFallback: t.tasks.updateLabelDefault,
      requestedStatus,
      spaceId,
      statusChangeLabelFallback: t.tasks.statusUpdatedLabel,
      taskSlug,
    });

    const successMessage =
      updated.updateKind === 'completion'
        ? t.tasks.updateSuccessCompleted
        : updated.updateKind === 'status_change'
          ? t.tasks.updateSuccessStatus
          : t.tasks.updateSuccess;

    revalidatePath('/home');
    revalidatePath('/issues');
    revalidatePath('/tasks');
    revalidatePath('/activity');
    revalidatePath(`/tasks/${updated.taskSlug}`);
    revalidatePath(`/issues/${updated.issueSlug}`);

    if (updated.roomSlug) {
      revalidatePath(`/rooms/${updated.roomSlug}`);
    }

    redirectToTaskDetailSurface({
      message: successMessage,
      spaceId,
      taskSlug: updated.taskSlug,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToTaskDetailSurface({
      error: getFriendlyKeepCozyTaskErrorMessage({
        error,
        fallback: t.tasks.updateFailed,
        language,
        surface: 'keepcozy:append-task-update',
      }),
      spaceId,
      taskSlug,
      ...draft,
    });
  }
}

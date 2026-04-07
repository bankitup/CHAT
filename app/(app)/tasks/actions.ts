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

function redirectToNewTaskSurface(input: {
  error?: string | null;
  issueSlug?: string | null;
  message?: string | null;
  spaceId?: string | null;
}): never {
  const params = new URLSearchParams();

  if (input.issueSlug?.trim()) {
    params.set('issue', input.issueSlug.trim());
  }

  if (input.error?.trim()) {
    params.set('error', input.error.trim());
  }

  if (input.message?.trim()) {
    params.set('message', input.message.trim());
  }

  const href = params.toString() ? `/tasks/new?${params.toString()}` : '/tasks/new';
  redirect(withSpaceParam(href, input.spaceId));
}

function redirectToTaskDetailSurface(input: {
  error?: string | null;
  message?: string | null;
  spaceId?: string | null;
  taskSlug: string;
}): never {
  const params = new URLSearchParams();

  if (input.error?.trim()) {
    params.set('error', input.error.trim());
  }

  if (input.message?.trim()) {
    params.set('message', input.message.trim());
  }

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

  if (!issueSlug) {
    redirectToNewTaskSurface({
      error: t.tasks.issueRequired,
      issueSlug,
      spaceId,
    });
  }

  if (!title) {
    redirectToNewTaskSurface({
      error: t.tasks.titleRequired,
      issueSlug,
      spaceId,
    });
  }

  if (!firstUpdateBody) {
    redirectToNewTaskSurface({
      error: t.tasks.firstUpdateRequired,
      issueSlug,
      spaceId,
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
      issueSlug,
      spaceId,
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
  const requestedStatus = normalizeKeepCozyTaskStatus(readText(formData, 'status'));

  if (!body) {
    redirectToTaskDetailSurface({
      error: t.tasks.updateBodyRequired,
      spaceId,
      taskSlug,
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
      message: t.tasks.updateSuccess,
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
    });
  }
}

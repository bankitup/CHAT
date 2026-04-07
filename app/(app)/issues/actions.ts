'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  appendKeepCozyIssueUpdate,
  createKeepCozyIssue,
  normalizeKeepCozyIssueStatus,
} from '@/modules/keepcozy/write-server';
import {
  logControlledUiError,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import { withSpaceParam } from '@/modules/spaces/url';

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function redirectToNewIssueSurface(input: {
  error?: string | null;
  message?: string | null;
  roomSlug?: string | null;
  spaceId?: string | null;
}): never {
  const params = new URLSearchParams();

  if (input.roomSlug?.trim()) {
    params.set('room', input.roomSlug.trim());
  }

  if (input.error?.trim()) {
    params.set('error', input.error.trim());
  }

  if (input.message?.trim()) {
    params.set('message', input.message.trim());
  }

  const href = params.toString() ? `/issues/new?${params}` : '/issues/new';
  redirect(withSpaceParam(href, input.spaceId));
}

function redirectToIssueDetailSurface(input: {
  error?: string | null;
  issueSlug: string;
  message?: string | null;
  spaceId?: string | null;
}): never {
  const params = new URLSearchParams();

  if (input.error?.trim()) {
    params.set('error', input.error.trim());
  }

  if (input.message?.trim()) {
    params.set('message', input.message.trim());
  }

  const baseHref = params.toString()
    ? `/issues/${input.issueSlug}?${params.toString()}`
    : `/issues/${input.issueSlug}`;

  redirect(withSpaceParam(baseHref, input.spaceId));
}

function getFriendlyKeepCozyIssueErrorMessage(input: {
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

export async function createIssueAction(formData: FormData) {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const spaceId = readText(formData, 'spaceId');
  const roomSlug = readText(formData, 'roomSlug');
  const title = readText(formData, 'title');
  const summary = readText(formData, 'summary');
  const nextStep = readText(formData, 'nextStep');
  const firstUpdateBody = readText(formData, 'firstUpdateBody');

  if (!title) {
    redirectToNewIssueSurface({
      error: t.issues.titleRequired,
      roomSlug,
      spaceId,
    });
  }

  if (!firstUpdateBody) {
    redirectToNewIssueSurface({
      error: t.issues.firstUpdateRequired,
      roomSlug,
      spaceId,
    });
  }

  try {
    const created = await createKeepCozyIssue({
      firstUpdateBody,
      firstUpdateLabel: t.issues.loggedLabel,
      nextStep,
      roomSlug,
      spaceId,
      summary,
      title,
    });

    revalidatePath('/home');
    revalidatePath('/issues');
    revalidatePath('/rooms');
    revalidatePath('/activity');
    revalidatePath(`/issues/${created.issueSlug}`);

    if (created.roomSlug) {
      revalidatePath(`/rooms/${created.roomSlug}`);
    }

    redirectToIssueDetailSurface({
      issueSlug: created.issueSlug,
      message: t.issues.createSuccess,
      spaceId,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToNewIssueSurface({
      error: getFriendlyKeepCozyIssueErrorMessage({
        error,
        fallback: t.issues.createFailed,
        language,
        surface: 'keepcozy:create-issue',
      }),
      roomSlug,
      spaceId,
    });
  }
}

export async function appendIssueUpdateAction(formData: FormData) {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const spaceId = readText(formData, 'spaceId');
  const issueSlug = readText(formData, 'issueId');
  const label = readText(formData, 'label');
  const body = readText(formData, 'body');
  const requestedStatus = normalizeKeepCozyIssueStatus(readText(formData, 'status'));

  if (!body) {
    redirectToIssueDetailSurface({
      error: t.issues.updateBodyRequired,
      issueSlug,
      spaceId,
    });
  }

  try {
    const updated = await appendKeepCozyIssueUpdate({
      body,
      issueSlug,
      label,
      noteLabelFallback: t.issues.updateLabelDefault,
      requestedStatus,
      resolutionLabelFallback: t.issues.resolvedLabel,
      spaceId,
      statusChangeLabelFallback: t.issues.statusUpdatedLabel,
    });

    revalidatePath('/issues');
    revalidatePath('/activity');
    revalidatePath(`/issues/${updated.issueSlug}`);

    if (updated.roomSlug) {
      revalidatePath(`/rooms/${updated.roomSlug}`);
    }

    redirectToIssueDetailSurface({
      issueSlug: updated.issueSlug,
      message: t.issues.updateSuccess,
      spaceId,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToIssueDetailSurface({
      error: getFriendlyKeepCozyIssueErrorMessage({
        error,
        fallback: t.issues.updateFailed,
        language,
        surface: 'keepcozy:append-issue-update',
      }),
      issueSlug,
      spaceId,
    });
  }
}

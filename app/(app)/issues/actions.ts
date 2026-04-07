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

function setTextParam(params: URLSearchParams, key: string, value?: string | null) {
  const normalized = value?.trim() ?? '';

  if (normalized) {
    params.set(key, normalized);
  }
}

function redirectToNewIssueSurface(input: {
  error?: string | null;
  firstUpdateBody?: string | null;
  message?: string | null;
  nextStep?: string | null;
  roomSlug?: string | null;
  spaceId?: string | null;
  summary?: string | null;
  title?: string | null;
}): never {
  const params = new URLSearchParams();

  setTextParam(params, 'room', input.roomSlug);
  setTextParam(params, 'title', input.title);
  setTextParam(params, 'summary', input.summary);
  setTextParam(params, 'nextStep', input.nextStep);
  setTextParam(params, 'firstUpdateBody', input.firstUpdateBody);
  setTextParam(params, 'error', input.error);
  setTextParam(params, 'message', input.message);

  const href = params.toString() ? `/issues/new?${params}` : '/issues/new';
  redirect(withSpaceParam(href, input.spaceId));
}

function redirectToIssueDetailSurface(input: {
  body?: string | null;
  error?: string | null;
  issueSlug: string;
  label?: string | null;
  message?: string | null;
  spaceId?: string | null;
  status?: string | null;
}): never {
  const params = new URLSearchParams();

  setTextParam(params, 'label', input.label);
  setTextParam(params, 'body', input.body);
  setTextParam(params, 'status', input.status);
  setTextParam(params, 'error', input.error);
  setTextParam(params, 'message', input.message);

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
  const draft = {
    firstUpdateBody,
    nextStep,
    roomSlug,
    summary,
    title,
  };

  if (!title) {
    redirectToNewIssueSurface({
      error: t.issues.titleRequired,
      spaceId,
      ...draft,
    });
  }

  if (!firstUpdateBody) {
    redirectToNewIssueSurface({
      error: t.issues.firstUpdateRequired,
      spaceId,
      ...draft,
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
      spaceId,
      ...draft,
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
  const requestedStatusRaw = readText(formData, 'status');
  const requestedStatus = normalizeKeepCozyIssueStatus(requestedStatusRaw);
  const draft = {
    body,
    label,
    status: requestedStatusRaw,
  };

  if (requestedStatusRaw && !requestedStatus) {
    redirectToIssueDetailSurface({
      error: t.issues.statusInvalid,
      issueSlug,
      spaceId,
      ...draft,
    });
  }

  if (!body) {
    redirectToIssueDetailSurface({
      error: t.issues.updateBodyRequired,
      issueSlug,
      spaceId,
      ...draft,
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

    const successMessage =
      updated.updateKind === 'resolution'
        ? t.issues.updateSuccessResolved
        : updated.updateKind === 'status_change'
          ? t.issues.updateSuccessStatus
          : t.issues.updateSuccess;

    revalidatePath('/home');
    revalidatePath('/issues');
    revalidatePath('/activity');
    revalidatePath(`/issues/${updated.issueSlug}`);

    if (updated.roomSlug) {
      revalidatePath(`/rooms/${updated.roomSlug}`);
    }

    redirectToIssueDetailSurface({
      issueSlug: updated.issueSlug,
      message: successMessage,
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
      ...draft,
    });
  }
}

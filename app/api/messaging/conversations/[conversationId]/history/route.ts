import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getConversationHistorySnapshot } from '@/modules/messaging/data/thread-read-server';
import {
  assertConversationMembership,
} from '@/modules/messaging/data/conversation-lifecycle-server';
import { NextResponse } from 'next/server';

type ConversationHistoryRouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

type HistoryRouteMode = 'latest' | 'before-seq' | 'after-seq' | 'by-id';

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizePositiveInteger(
  value: string | null,
  fallback: number,
  max: number,
) {
  const parsed = Number(value ?? '');

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function normalizeBeforeSeq(value: string | null) {
  const parsed = Number(value ?? '');

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function normalizeAfterSeq(value: string | null) {
  const parsed = Number(value ?? '');

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
}

function normalizeActiveDeviceId(value: string | null) {
  const trimmed = value?.trim() || '';
  return looksLikeUuid(trimmed) ? trimmed : null;
}

function shouldLogHistoryRouteDiagnostics() {
  return (
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1'
  );
}

function logHistoryRouteDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!shouldLogHistoryRouteDiagnostics()) {
    return;
  }

  if (details) {
    console.info('[chat-history-route]', stage, details);
    return;
  }

  console.info('[chat-history-route]', stage);
}

function shouldSuppressRedundantByIdModeConflict(input: {
  mode: HistoryRouteMode;
  requestedModes: string[];
  requestedMessageIdsCount: number;
}) {
  return (
    input.mode === 'by-id' &&
    input.requestedMessageIdsCount > 0 &&
    input.requestedModes.every(
      (requestedMode) =>
        requestedMode === 'by-id' ||
        requestedMode === 'after-seq' ||
        requestedMode === 'before-seq',
    )
  );
}

function createEmptyHistorySnapshot() {
  return {
    attachmentsByMessage: [],
    dmE2ee: null,
    hasMoreOlder: false,
    messages: [],
    oldestMessageSeq: null,
    reactionsByMessage: [],
    senderProfiles: [],
  };
}

export async function GET(
  request: Request,
  context: ConversationHistoryRouteContext,
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { conversationId } = await context.params;
  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const rawBeforeSeqExclusive = normalizeBeforeSeq(searchParams.get('beforeSeq'));
  const rawAfterSeqExclusive = normalizeAfterSeq(searchParams.get('afterSeq'));
  const preferredDeviceRecordId = normalizeActiveDeviceId(
    searchParams.get('activeDeviceId'),
  );
  const requestedMessageIds = Array.from(
    new Set(searchParams.getAll('messageId').map((messageId) => messageId.trim()).filter(Boolean)),
  );
  const rawMessageIds = requestedMessageIds.filter(looksLikeUuid);
  const droppedInvalidMessageIds = requestedMessageIds.filter(
    (messageId) => !looksLikeUuid(messageId),
  );
  const requestedModes = [
    rawBeforeSeqExclusive !== null ? 'before-seq' : null,
    rawAfterSeqExclusive !== null ? 'after-seq' : null,
    rawMessageIds.length > 0 ? 'by-id' : null,
  ].filter((value): value is string => Boolean(value));

  const messageIds =
    rawMessageIds.length > 0 ? rawMessageIds : [];

  if (droppedInvalidMessageIds.length > 0) {
    logHistoryRouteDiagnostics('validation:invalid-message-ids-dropped', {
      conversationId,
      droppedCount: droppedInvalidMessageIds.length,
      droppedMessageIds: droppedInvalidMessageIds,
      preservedMessageIds: rawMessageIds,
    });
  }

  const afterSeqExclusive =
    rawMessageIds.length === 0 ? rawAfterSeqExclusive : null;
  const beforeSeqExclusive =
    rawMessageIds.length === 0 && rawAfterSeqExclusive === null
      ? rawBeforeSeqExclusive
      : null;
  const mode: HistoryRouteMode =
    messageIds.length > 0
      ? 'by-id'
      : afterSeqExclusive !== null
        ? 'after-seq'
        : beforeSeqExclusive !== null
          ? 'before-seq'
          : 'latest';

  if (
    requestedModes.length > 1 &&
    !shouldSuppressRedundantByIdModeConflict({
      mode,
      requestedMessageIdsCount: rawMessageIds.length,
      requestedModes,
    })
  ) {
    logHistoryRouteDiagnostics('validation:mode-conflict-normalized', {
      afterSeqExclusive: rawAfterSeqExclusive,
      beforeSeqExclusive: rawBeforeSeqExclusive,
      conversationId,
      messageIdsCount: rawMessageIds.length,
      normalizedMode: mode,
      requestedModes,
    });
  }

  if (
    requestedMessageIds.length > 0 &&
    messageIds.length === 0 &&
    afterSeqExclusive === null &&
    beforeSeqExclusive === null
  ) {
    logHistoryRouteDiagnostics('validation:empty-by-id-fallback', {
      conversationId,
      requestedMessageIds,
    });

    return NextResponse.json(
      createEmptyHistorySnapshot(),
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      },
    );
  }

  logHistoryRouteDiagnostics('request:normalized', {
    activeDeviceIdPresent: Boolean(preferredDeviceRecordId),
    afterSeqExclusive,
    beforeSeqExclusive,
    conversationId,
    limit: normalizePositiveInteger(searchParams.get('limit'), 26, 104),
    messageIdsCount: messageIds.length,
    mode,
  });

  const snapshot = await getConversationHistorySnapshot({
    afterSeqExclusive,
    beforeSeqExclusive,
    conversationId,
    debugRequestId: searchParams.get('debugRequestId'),
    limit: normalizePositiveInteger(searchParams.get('limit'), 26, 104),
    messageIds,
    preferredDeviceRecordId,
    userId: user.id,
  });

  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  });
}

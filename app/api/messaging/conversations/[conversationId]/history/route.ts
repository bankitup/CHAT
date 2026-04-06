import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  assertConversationMembership,
  getConversationHistorySnapshot,
} from '@/modules/messaging/data/server';
import { NextResponse } from 'next/server';

type ConversationHistoryRouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

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
    rawMessageIds.length > 0
      ? rawMessageIds
      : [];

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

  if (requestedModes.length > 1) {
    logHistoryRouteDiagnostics('validation:mode-conflict-normalized', {
      afterSeqExclusive: rawAfterSeqExclusive,
      beforeSeqExclusive: rawBeforeSeqExclusive,
      conversationId,
      messageIdsCount: rawMessageIds.length,
      normalizedMode:
        messageIds.length > 0
          ? 'by-id'
          : afterSeqExclusive !== null
            ? 'after-seq'
            : beforeSeqExclusive !== null
              ? 'before-seq'
              : 'latest',
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
      {
        attachmentsByMessage: [],
        hasMoreOlder: false,
        messages: [],
        oldestMessageSeq: null,
        reactionsByMessage: [],
        senderProfiles: [],
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      },
    );
  }

  const snapshot = await getConversationHistorySnapshot({
    afterSeqExclusive,
    beforeSeqExclusive,
    conversationId,
    debugRequestId: searchParams.get('debugRequestId'),
    limit: normalizePositiveInteger(searchParams.get('limit'), 26, 104),
    messageIds,
    userId: user.id,
  });

  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  });
}

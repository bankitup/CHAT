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
  const beforeSeqExclusive = normalizeBeforeSeq(searchParams.get('beforeSeq'));
  const afterSeqExclusive = normalizeAfterSeq(searchParams.get('afterSeq'));
  const messageIds = Array.from(
    new Set(searchParams.getAll('messageId').map((messageId) => messageId.trim()).filter(Boolean)),
  );

  if (
    Number(beforeSeqExclusive !== null) +
      Number(afterSeqExclusive !== null) +
      Number(messageIds.length > 0) >
    1
  ) {
    return NextResponse.json(
      { error: 'Choose only one history cursor mode per request.' },
      { status: 400 },
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

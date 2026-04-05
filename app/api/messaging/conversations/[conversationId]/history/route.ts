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
  const snapshot = await getConversationHistorySnapshot({
    beforeSeqExclusive: normalizeBeforeSeq(searchParams.get('beforeSeq')),
    conversationId,
    debugRequestId: searchParams.get('debugRequestId'),
    limit: normalizePositiveInteger(searchParams.get('limit'), 26, 104),
    userId: user.id,
  });

  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  });
}

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  assertConversationMembership,
  resolveConversationAttachmentSignedUrl,
} from '@/modules/messaging/data/server';
import { NextResponse } from 'next/server';

type AttachmentSignedUrlRouteContext = {
  params: Promise<{
    attachmentId: string;
    conversationId: string;
    messageId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: AttachmentSignedUrlRouteContext,
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { attachmentId, conversationId, messageId } = await context.params;
  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const resolved = await resolveConversationAttachmentSignedUrl({
    attachmentId,
    conversationId,
    messageId,
    userId: user.id,
  });

  if (!resolved) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!resolved.signedUrl) {
    return NextResponse.json(
      { error: 'Attachment URL unavailable right now.' },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
        status: 409,
      },
    );
  }

  return NextResponse.json(
    {
      signedUrl: resolved.signedUrl,
      source: resolved.source,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}

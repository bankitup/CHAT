import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  assertConversationMembership,
  resolveConversationAttachmentContentTarget,
} from '@/modules/messaging/data/server';

type ConversationAttachmentContentRouteContext = {
  params: Promise<{
    attachmentId: string;
    conversationId: string;
    messageId: string;
  }>;
};

function buildInlineContentDisposition(fileName: string | null) {
  if (!fileName?.trim()) {
    return 'inline';
  }

  return `inline; filename*=UTF-8''${encodeURIComponent(fileName.trim())}`;
}

export async function GET(
  _request: Request,
  context: ConversationAttachmentContentRouteContext,
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { attachmentId, conversationId, messageId } = await context.params;
  const isMember = await assertConversationMembership(conversationId, user.id);

  if (!isMember) {
    return new Response('Not found', { status: 404 });
  }

  const resolvedTarget = await resolveConversationAttachmentContentTarget({
    attachmentId,
    conversationId,
    messageId,
    userId: user.id,
  });

  if (!resolvedTarget) {
    return new Response('Not found', { status: 404 });
  }

  const serviceSupabase = createSupabaseServiceRoleClient();
  const storageClient = serviceSupabase ?? supabase;
  const download = await storageClient.storage
    .from(resolvedTarget.bucket)
    .download(resolvedTarget.objectPath);

  if (download.error || !download.data) {
    return new Response('Not found', { status: 404 });
  }

  const body = await download.data.arrayBuffer();
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Disposition': buildInlineContentDisposition(resolvedTarget.fileName),
    'X-Content-Type-Options': 'nosniff',
  });

  if (download.data.type || resolvedTarget.mimeType) {
    headers.set('Content-Type', download.data.type || resolvedTarget.mimeType || 'application/octet-stream');
  }

  headers.set('Content-Length', String(body.byteLength));

  return new Response(body, {
    headers,
    status: 200,
  });
}

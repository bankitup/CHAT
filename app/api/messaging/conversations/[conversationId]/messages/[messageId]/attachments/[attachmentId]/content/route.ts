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

  const resolved = await resolveConversationAttachmentContentTarget({
    attachmentId,
    conversationId,
    messageId,
    userId: user.id,
  });

  if (!resolved) {
    return new Response('Not found', { status: 404 });
  }

  const storageClient = createSupabaseServiceRoleClient() ?? supabase;
  const download = await storageClient.storage
    .from(resolved.bucket)
    .download(resolved.objectPath);

  if (download.error || !download.data) {
    return new Response('Not found', { status: 404 });
  }

  const body = await download.data.arrayBuffer();
  const headers = new Headers();
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Vary', 'Cookie');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set(
    'Content-Disposition',
    buildInlineContentDisposition(resolved.fileName),
  );

  const contentType = download.data.type || resolved.mimeType || null;

  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  headers.set('Content-Length', String(body.byteLength));

  return new Response(body, {
    headers,
    status: 200,
  });
}

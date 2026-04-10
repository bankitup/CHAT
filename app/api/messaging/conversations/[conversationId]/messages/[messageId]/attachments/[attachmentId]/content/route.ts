import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  assertConversationMembership,
  resolveConversationAttachmentContentTarget,
} from '@/modules/messaging/data/server';

export async function GET(
  _request: Request,
  context: {
    params: Promise<unknown>;
  },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { attachmentId, conversationId, messageId } = (await context.params) as {
    attachmentId: string;
    conversationId: string;
    messageId: string;
  };
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
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    Vary: 'Cookie',
    'X-Content-Type-Options': 'nosniff',
  });

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

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import {
  decodeAvatarDeliveryPathSegments,
} from '@/modules/messaging/avatar-delivery';
import { PROFILE_AVATAR_BUCKET } from '@/modules/profile/avatar';

const avatarDiagnosticsEnabled = process.env.CHAT_DEBUG_AVATARS === '1';
const AVATAR_CACHE_CONTROL = 'private, max-age=31536000, immutable';

function logAvatarRouteDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!avatarDiagnosticsEnabled) {
    return;
  }

  if (details) {
    console.info('[avatar-route]', stage, details);
    return;
  }

  console.info('[avatar-route]', stage);
}

type AvatarRouteContext = {
  params: Promise<{
    objectPath?: string[];
  }>;
};

export async function GET(_request: Request, context: AvatarRouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { objectPath = [] } = await context.params;
  const normalizedObjectPath = decodeAvatarDeliveryPathSegments(objectPath);

  if (!normalizedObjectPath) {
    return new Response('Not found', { status: 404 });
  }

  const serviceSupabase = createSupabaseServiceRoleClient();
  const storageClient = serviceSupabase ?? supabase;
  const source = serviceSupabase ? 'service' : 'auth';
  const download = await storageClient.storage
    .from(PROFILE_AVATAR_BUCKET)
    .download(normalizedObjectPath);

  if (download.error || !download.data) {
    logAvatarRouteDiagnostics('download:error', {
      bucket: PROFILE_AVATAR_BUCKET,
      message: download.error?.message ?? 'unknown',
      objectPath: normalizedObjectPath,
      source,
      userId: user.id,
    });

    return new Response('Not found', { status: 404 });
  }

  const body = await download.data.arrayBuffer();
  const headers = new Headers({
    'Cache-Control': AVATAR_CACHE_CONTROL,
  });

  if (download.data.type) {
    headers.set('Content-Type', download.data.type);
  }

  headers.set('Content-Length', String(body.byteLength));

  logAvatarRouteDiagnostics('download:ok', {
    bucket: PROFILE_AVATAR_BUCKET,
    objectPath: normalizedObjectPath,
    source,
    userId: user.id,
  });

  return new Response(body, {
    headers,
    status: 200,
  });
}

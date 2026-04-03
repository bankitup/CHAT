import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { PublishDmE2eeDeviceRequest } from '@/modules/messaging/contract/dm-e2ee';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import { publishCurrentUserDmE2eeDevice } from '@/modules/messaging/data/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (
    !isDmE2eeEnabledForUser(user.id, user.email ?? null, {
      source: 'api-dm-e2ee-device',
    })
  ) {
    return NextResponse.json(
      {
        error: 'Encrypted direct messages are not enabled for this account yet.',
        code: 'dm_e2ee_rollout_disabled',
      },
      { status: 403 },
    );
  }

  const input = (await request.json()) as PublishDmE2eeDeviceRequest;

  try {
    const result = await publishCurrentUserDmE2eeDevice({
      userId: user.id,
      ...input,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to publish DM E2EE device.';

    if (message.includes('DM E2EE bootstrap schema is missing')) {
      return NextResponse.json(
        {
          error: message,
          code: 'dm_e2ee_schema_missing',
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: 'Unable to refresh encrypted setup on this device.' },
      { status: 400 },
    );
  }
}

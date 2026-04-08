import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getChatUnreadBadgeStateForUser } from '@/modules/messaging/push/server';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const state = await getChatUnreadBadgeStateForUser({
      userId: user.id,
    });

    return NextResponse.json(state, {
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: 'Unable to load unread badge state right now.',
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
        status: 400,
      },
    );
  }
}

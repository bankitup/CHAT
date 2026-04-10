import { NextResponse } from 'next/server';
import { getRequestViewer } from '@/lib/request-context/server';
import {
  getAvailableUsers,
  getExistingActiveDmPartnerUserIdsForCandidates,
} from '@/modules/messaging/data/server';
import { isSpaceMembersSchemaCacheErrorMessage } from '@/modules/spaces/server';

const CREATE_TARGETS_NO_STORE_HEADERS = {
  'cache-control': 'no-store',
};

export async function GET(request: Request) {
  const user = await getRequestViewer();

  if (!user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized.' },
      {
        headers: CREATE_TARGETS_NO_STORE_HEADERS,
        status: 401,
      },
    );
  }

  const requestUrl = new URL(request.url);
  const spaceId = requestUrl.searchParams.get('space')?.trim() || null;

  if (!spaceId) {
    return NextResponse.json(
      { error: 'Space is required.' },
      {
        headers: CREATE_TARGETS_NO_STORE_HEADERS,
        status: 400,
      },
    );
  }

  try {
    const users = await getAvailableUsers(user.id, {
      source: 'inbox-create-targets-route',
      spaceId,
    });

    const existingDmPartnerUserIds =
      await getExistingActiveDmPartnerUserIdsForCandidates(
        user.id,
        users.map((userEntry) => userEntry.userId),
        {
          spaceId,
        },
      ).catch(() => [] as string[]);

    return NextResponse.json(
      {
        existingDmPartnerUserIds,
        users,
      },
      {
        headers: CREATE_TARGETS_NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isSpaceMembersSchemaCacheErrorMessage(message)) {
      return NextResponse.json(
        {
          existingDmPartnerUserIds: [],
          users: [],
        },
        {
          headers: CREATE_TARGETS_NO_STORE_HEADERS,
        },
      );
    }

    return NextResponse.json(
      {
        error: 'Unable to load people right now.',
      },
      {
        headers: CREATE_TARGETS_NO_STORE_HEADERS,
        status: 400,
      },
    );
  }
}

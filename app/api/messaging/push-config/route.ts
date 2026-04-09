import { NextResponse } from 'next/server';
import { getWebPushRuntimeConfig } from '@/modules/messaging/push/server';

export async function GET() {
  const config = getWebPushRuntimeConfig();

  return NextResponse.json(config, {
    headers: {
      'cache-control': 'no-store',
    },
  });
}

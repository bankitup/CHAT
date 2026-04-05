import 'server-only';

import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const getRequestSupabaseServerClient = cache(async () => {
  return createSupabaseServerClient();
});

export const getRequestViewer = cache(async () => {
  const supabase = await getRequestSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ? user : null;
});

export async function requireRequestViewer(surface: string): Promise<User> {
  const user = await getRequestViewer();

  if (!user?.id) {
    throw new Error(`${surface}: no authenticated user found.`);
  }

  return user;
}

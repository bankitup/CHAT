'use server';

import { redirect } from 'next/navigation';
import { getRequestSupabaseServerClient } from '@/lib/request-context/server';

export async function logoutAction() {
  const supabase = await getRequestSupabaseServerClient();

  await supabase.auth.signOut();

  redirect('/');
}

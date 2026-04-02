'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateCurrentUserProfile } from '@/modules/messaging/data/server';

function redirectWithMessage(
  kind: 'error' | 'message',
  value: string,
): never {
  const params = new URLSearchParams({ [kind]: value });
  redirect(`/settings?${params.toString()}`);
}

export async function updateProfileAction(formData: FormData) {
  const displayName = String(formData.get('displayName') ?? '').trim();
  const avatarEntry = formData.get('avatar');
  const avatarFile =
    avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithMessage('error', 'You must be signed in to update your profile.');
  }

  try {
    await updateCurrentUserProfile({
      userId: user.id,
      displayName: displayName || null,
      avatarFile,
    });
  } catch (error) {
    redirectWithMessage(
      'error',
      error instanceof Error ? error.message : 'Unable to update your profile.',
    );
  }

  redirectWithMessage('message', 'Profile updated.');
}

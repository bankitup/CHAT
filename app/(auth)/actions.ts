'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === 'string' ? value.trim() : '';
}

function redirectWithMessage(
  path: '/login' | '/signup',
  type: 'error' | 'message',
  value: string,
) {
  const params = new URLSearchParams({ [type]: value });
  redirect(`${path}?${params.toString()}`);
}

export async function loginAction(formData: FormData) {
  const email = readFormValue(formData, 'email');
  const password = readFormValue(formData, 'password');

  if (!email || !password) {
    redirectWithMessage('/login', 'error', 'Email and password are required.');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectWithMessage('/login', 'error', error.message);
  }

  redirect('/inbox');
}

export async function signupAction(formData: FormData) {
  const email = readFormValue(formData, 'email');
  const password = readFormValue(formData, 'password');

  if (!email || !password) {
    redirectWithMessage('/signup', 'error', 'Email and password are required.');
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirectWithMessage('/signup', 'error', error.message);
  }

  if (data.session) {
    redirect('/inbox');
  }

  redirectWithMessage(
    '/login',
    'message',
    'Account created. Check your email if confirmation is enabled.',
  );
}

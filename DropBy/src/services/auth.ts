import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Constants.expoConfig?.extra?.googleClientId,
    webClientId: Constants.expoConfig?.extra?.googleWebClientId,
    scopes: [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });
  return { request, response, promptAsync };
}

export async function signInWithGoogle(idToken: string, accessToken: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    access_token: accessToken,
  });
  if (error) throw error;

  // Upsert user profile
  if (data.user) {
    await supabase.from('users').upsert({
      id: data.user.id,
      email: data.user.email ?? '',
      display_name: data.user.user_metadata?.full_name ?? data.user.email ?? 'User',
      avatar_url: data.user.user_metadata?.avatar_url,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      google_account_id: data.user.user_metadata?.sub,
    }, { onConflict: 'id' });

    // Promote any pending invitations to full memberships
    await promotePendingInvites(data.user.email ?? '');
  }

  return data;
}

async function promotePendingInvites(email: string) {
  const { data: pending } = await supabase
    .from('pending_members')
    .select('circle_id, invited_by')
    .eq('invited_email', email.toLowerCase());

  if (!pending || pending.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  for (const invite of pending) {
    await supabase.from('circle_memberships').upsert({
      circle_id: invite.circle_id,
      user_id: user.id,
      role: 'member',
    }, { onConflict: 'circle_id,user_id' });
  }

  await supabase.from('pending_members').delete().eq('invited_email', email.toLowerCase());
}

export async function signOut() {
  await supabase.auth.signOut();
}

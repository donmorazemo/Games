import { supabase } from '../lib/supabase';
import { DropByIntent } from '../types';

export async function createDropByIntent(
  hostId: string,
  windowId: string
): Promise<DropByIntent> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Call the Supabase edge function for atomic intent creation + notification
  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = (supabase as any).supabaseUrl as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/create-drop-by-intent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ visitor_id: user.id, host_id: hostId, window_id: windowId }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to create drop by intent');
  }

  return res.json() as Promise<DropByIntent>;
}

export async function cancelDropByIntent(intentId: string): Promise<DropByIntent> {
  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = (supabase as any).supabaseUrl as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/cancel-drop-by-intent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ intent_id: intentId }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to cancel drop by intent');
  }

  return res.json() as Promise<DropByIntent>;
}

export async function getActiveIntentsForUser(userId: string): Promise<DropByIntent[]> {
  const { data, error } = await supabase
    .from('drop_by_intents')
    .select('*, visitor:users!visitor_id(id, display_name, avatar_url), host:users!host_id(id, display_name, avatar_url), window:open_windows(*)')
    .eq('visitor_id', userId)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []) as unknown as DropByIntent[];
}

export async function getIncomingIntentsForUser(userId: string): Promise<DropByIntent[]> {
  const { data, error } = await supabase
    .from('drop_by_intents')
    .select('*, visitor:users!visitor_id(id, display_name, avatar_url)')
    .eq('host_id', userId)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []) as unknown as DropByIntent[];
}

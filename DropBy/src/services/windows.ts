import { supabase } from '../lib/supabase';
import { OpenWindow } from '../types';
import { createOpenWindowEvent } from './calendar';

export async function getMyWindows(): Promise<OpenWindow[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('open_windows')
    .select('*, circles(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, circle: row.circles }));
}

export async function getWindowsForCircle(circleId: string): Promise<OpenWindow[]> {
  const { data, error } = await supabase
    .from('open_windows')
    .select('*, users(id, display_name, avatar_url), circles(id, name)')
    .eq('circle_id', circleId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, user: row.users, circle: row.circles }));
}

export async function createOpenWindow(
  params: Pick<OpenWindow, 'circle_id' | 'rrule' | 'start_time' | 'end_time'>
): Promise<OpenWindow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Try to create the calendar event first
  let googleCalendarId: string | undefined;
  let googleEventId: string | undefined;
  try {
    const { data: circle } = await supabase
      .from('circles')
      .select('google_calendar_id')
      .eq('id', params.circle_id)
      .single();

    if (circle?.google_calendar_id) {
      googleCalendarId = circle.google_calendar_id;
      googleEventId = await createOpenWindowEvent(circle.google_calendar_id, {
        user_id: user.id,
        ...params,
        title: 'Free — Come Over',
        timezone,
      });
    }
  } catch (e) {
    console.warn('Could not create Google Calendar event:', e);
  }

  const { data, error } = await supabase
    .from('open_windows')
    .insert({
      user_id: user.id,
      title: 'Free — Come Over',
      timezone,
      google_calendar_id: googleCalendarId,
      google_event_id: googleEventId,
      ...params,
    })
    .select('*, circles(id, name)')
    .single();

  if (error) throw error;
  return { ...(data as any), circle: (data as any).circles } as OpenWindow;
}

export async function deleteOpenWindow(windowId: string) {
  const { error } = await supabase.from('open_windows').delete().eq('id', windowId);
  if (error) throw error;
}

/** Returns windows that overlap with the current time of day on the current weekday */
export function isWindowActiveNow(window: OpenWindow): boolean {
  const now = new Date();
  const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const todayRRule = dayMap[now.getDay()];
  if (!window.rrule.includes(todayRRule)) return false;

  const [startH, startM] = window.start_time.split(':').map(Number);
  const [endH, endM] = window.end_time.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;
  return nowMins >= startMins && nowMins < endMins;
}

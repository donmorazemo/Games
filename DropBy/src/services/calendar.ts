import { supabase } from '../lib/supabase';
import { OpenWindow, DropByIntent } from '../types';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

async function getAccessTokenWithRefresh(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.provider_token) return session.provider_token;
  const { data: refreshed } = await supabase.auth.refreshSession();
  if (refreshed.session?.provider_token) return refreshed.session.provider_token;
  throw new Error('Google Calendar access token unavailable. Please sign in again.');
}

/** Returns the date string (YYYY-MM-DD) of the next occurrence of a given weekday */
function nextOccurrenceDate(byday: string): string {
  const dayMap: Record<string, number> = {
    SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
  };
  const target = dayMap[byday];
  if (target === undefined) return new Date().toISOString().split('T')[0];
  const today = new Date();
  const todayDay = today.getDay();
  const daysAhead = (target - todayDay + 7) % 7 || 7;
  const next = new Date(today.getTime() + daysAhead * 86400000);
  return next.toISOString().split('T')[0];
}

function buildDateTime(time: string, dateStr: string): string {
  return `${dateStr}T${time}:00`;
}

export async function createCircleCalendar(circleName: string): Promise<string> {
  const token = await getAccessTokenWithRefresh();
  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: `Drop By — ${circleName}`,
      description: 'Managed by Drop By. Open hours for friends to come over.',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  if (!res.ok) throw new Error('Failed to create circle calendar');
  const cal = await res.json();
  return cal.id as string;
}

export async function shareCalendarWithMember(calendarId: string, email: string) {
  const token = await getAccessTokenWithRefresh();
  await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/acl`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', scope: { type: 'user', value: email } }),
    }
  );
}

export async function revokeCalendarAccess(calendarId: string, email: string) {
  const token = await getAccessTokenWithRefresh();
  const ruleId = `user:${email}`;
  await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/acl/${encodeURIComponent(ruleId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

export async function createOpenWindowEvent(
  calendarId: string,
  window: Omit<OpenWindow, 'id' | 'created_at' | 'google_calendar_id' | 'google_event_id'>
): Promise<string> {
  const token = await getAccessTokenWithRefresh();
  const bydayMatch = window.rrule.match(/BYDAY=([A-Z]+)/);
  const byday = bydayMatch ? bydayMatch[1].split(',')[0] : 'MO';
  const firstOccurrenceDate = nextOccurrenceDate(byday);
  const startDateTime = buildDateTime(window.start_time, firstOccurrenceDate);
  const endDateTime = buildDateTime(window.end_time, firstOccurrenceDate);

  const event = {
    summary: 'Free — Come Over',
    description: 'Drop By open hours. Friends are welcome.',
    start: { dateTime: startDateTime, timeZone: window.timezone },
    end: { dateTime: endDateTime, timeZone: window.timezone },
    recurrence: [window.rrule],
    extendedProperties: {
      private: {
        dropby_circle_id: window.circle_id,
        dropby_version: '1',
        dropby_intents: '[]',
      },
    },
  };

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) throw new Error('Failed to create calendar event');
  const ev = await res.json();
  return ev.id as string;
}

export async function getFreeBusy(
  timeMin: string,
  timeMax: string,
  calendarIds: string[] = ['primary']
): Promise<Array<{ start: string; end: string }>> {
  const token = await getAccessTokenWithRefresh();
  const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: calendarIds.map((id) => ({ id })),
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const busy: Array<{ start: string; end: string }> = [];
  for (const calId of calendarIds) {
    const periods = (data.calendars?.[calId]?.busy as Array<{ start: string; end: string }>) ?? [];
    busy.push(...periods);
  }
  return busy;
}

export async function writeIntentToCalendarEvent(
  calendarId: string,
  eventId: string,
  intent: DropByIntent
) {
  const token = await getAccessTokenWithRefresh();
  const getRes = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const event = await getRes.json();
  const existing = JSON.parse(
    (event.extendedProperties?.private?.dropby_intents as string) ?? '[]'
  ) as Array<{ visitor_id: string; visitor_name: string; status: string; created_at: string }>;

  const updated =
    intent.status === 'cancelled'
      ? existing.filter((i) => i.visitor_id !== intent.visitor_id)
      : [
          ...existing.filter((i) => i.visitor_id !== intent.visitor_id),
          {
            visitor_id: intent.visitor_id,
            visitor_name: intent.visitor?.display_name ?? '',
            status: 'active',
            created_at: intent.created_at,
          },
        ];

  await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extendedProperties: { private: { dropby_intents: JSON.stringify(updated) } },
      }),
    }
  );
}

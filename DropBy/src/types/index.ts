export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  timezone: string;
  google_account_id?: string;
  created_at: string;
}

export interface Circle {
  id: string;
  name: string;
  created_by: string;
  google_calendar_id?: string;
  created_at: string;
  member_count?: number;
  my_role?: 'admin' | 'member';
}

export interface CircleMembership {
  id: string;
  circle_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  user?: User;
  circle?: Circle;
}

export interface PendingMember {
  id: string;
  circle_id: string;
  invited_email: string;
  invited_by: string;
  created_at: string;
}

export interface OpenWindow {
  id: string;
  user_id: string;
  circle_id: string;
  title: string;
  rrule: string;
  start_time: string;
  end_time: string;
  timezone: string;
  google_calendar_id?: string;
  google_event_id?: string;
  created_at: string;
  circle?: Circle;
  user?: User;
}

export interface DropByIntent {
  id: string;
  visitor_id: string;
  host_id: string;
  window_id: string;
  status: 'active' | 'cancelled';
  created_at: string;
  updated_at: string;
  visitor?: User;
  host?: User;
  window?: OpenWindow;
}

export type AvailabilityStatus =
  | 'free'
  | 'out_tonight'
  | 'dropping_by'
  | 'unavailable'
  | 'no_window';

export interface UserAvailability {
  user: User;
  status: AvailabilityStatus;
  window?: OpenWindow;
  active_intent?: DropByIntent;
  incoming_intents?: DropByIntent[];
  label: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'drop_by_intent' | 'intent_cancelled' | 'window_conflict' | 'circle_invite';
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export type DayOfWeek = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

export const DAY_LABELS: Record<DayOfWeek, string> = {
  SU: 'Sunday',
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
};

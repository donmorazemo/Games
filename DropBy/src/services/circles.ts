import { supabase } from '../lib/supabase';
import { Circle, CircleMembership } from '../types';
import { createCircleCalendar, shareCalendarWithMember, revokeCalendarAccess } from './calendar';

export async function getMyCircles(): Promise<Circle[]> {
  const { data, error } = await supabase
    .from('circle_memberships')
    .select('role, circles(id, name, created_by, google_calendar_id, created_at)')
    .order('created_at', { referencedTable: 'circles', ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row.circles, my_role: row.role }));
}

export async function createCircle(name: string): Promise<Circle> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let googleCalendarId: string | undefined;
  try {
    googleCalendarId = await createCircleCalendar(name);
  } catch (e) {
    console.warn('Could not create Google Calendar:', e);
  }

  const { data, error } = await supabase
    .from('circles')
    .insert({ name, created_by: user.id, google_calendar_id: googleCalendarId })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('circle_memberships').insert({
    circle_id: data.id,
    user_id: user.id,
    role: 'admin',
  });

  return data as Circle;
}

export async function inviteMemberByEmail(circleId: string, email: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existingUser) {
    const { error } = await supabase.from('circle_memberships').insert({
      circle_id: circleId,
      user_id: existingUser.id,
      role: 'member',
    });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase.from('pending_members').insert({
      circle_id: circleId,
      invited_email: email.toLowerCase(),
      invited_by: user.id,
    });
    if (error && error.code !== '23505') throw error;
  }

  try {
    const { data: circle } = await supabase
      .from('circles')
      .select('google_calendar_id')
      .eq('id', circleId)
      .single();
    if (circle?.google_calendar_id) {
      await shareCalendarWithMember(circle.google_calendar_id, email);
    }
  } catch (e) {
    console.warn('Could not share calendar:', e);
  }
}

export async function getCircleMembers(circleId: string): Promise<CircleMembership[]> {
  const { data, error } = await supabase
    .from('circle_memberships')
    .select('*, users(id, display_name, email, avatar_url)')
    .eq('circle_id', circleId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, user: row.users }));
}

export async function removeMember(circleId: string, userId: string) {
  const { data: membership } = await supabase
    .from('circle_memberships')
    .select('role, users(email)')
    .eq('circle_id', circleId)
    .eq('user_id', userId)
    .single();

  if ((membership as any)?.role === 'admin') {
    const { count } = await supabase
      .from('circle_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('role', 'admin');
    if ((count ?? 0) <= 1) {
      throw new Error('Cannot remove the last admin. Promote another member first.');
    }
  }

  await supabase
    .from('circle_memberships')
    .delete()
    .eq('circle_id', circleId)
    .eq('user_id', userId);

  try {
    const email = (membership as any)?.users?.email;
    const { data: circle } = await supabase
      .from('circles')
      .select('google_calendar_id')
      .eq('id', circleId)
      .single();
    if (circle?.google_calendar_id && email) {
      await revokeCalendarAccess(circle.google_calendar_id, email);
    }
  } catch (e) {
    console.warn('Could not revoke calendar access:', e);
  }
}

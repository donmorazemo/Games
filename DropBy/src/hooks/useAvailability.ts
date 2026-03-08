import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserAvailability, AvailabilityStatus, OpenWindow, DropByIntent, User } from '../types';
import { isWindowActiveNow } from '../services/windows';

function computeStatus(
  windows: OpenWindow[],
  outgoingIntents: DropByIntent[]
): AvailabilityStatus {
  // If they have an active intent to go somewhere else, they're out
  if (outgoingIntents.some((i) => i.status === 'active')) return 'dropping_by';

  // Check if any window is active right now
  const activeWindow = windows.find((w) => isWindowActiveNow(w));
  if (activeWindow) return 'free';

  if (windows.length > 0) return 'out_tonight';
  return 'no_window';
}

function statusLabel(status: AvailabilityStatus, userName: string): string {
  switch (status) {
    case 'free':
      return 'Free — come over';
    case 'dropping_by':
      return 'Out — dropping by a friend';
    case 'out_tonight':
      return 'Not available right now';
    case 'unavailable':
      return 'Unavailable';
    case 'no_window':
      return 'No open hours set';
  }
}

export function useAvailability() {
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get all circles the user belongs to
      const { data: memberships } = await supabase
        .from('circle_memberships')
        .select('circle_id')
        .eq('user_id', user.id);

      const circleIds = (memberships ?? []).map((m: any) => m.circle_id as string);
      if (circleIds.length === 0) { setAvailability([]); setLoading(false); return; }

      // Get all members across those circles (excluding self)
      const { data: allMemberships } = await supabase
        .from('circle_memberships')
        .select('user_id, users(id, display_name, email, avatar_url, timezone)')
        .in('circle_id', circleIds)
        .neq('user_id', user.id);

      // Deduplicate users
      const userMap = new Map<string, User>();
      for (const m of allMemberships ?? []) {
        const u = (m as any).users as User;
        if (u && !userMap.has(u.id)) userMap.set(u.id, u);
      }

      const peerIds = Array.from(userMap.keys());
      if (peerIds.length === 0) { setAvailability([]); setLoading(false); return; }

      // Get open windows for all peers
      const { data: windows } = await supabase
        .from('open_windows')
        .select('*, circles(id, name)')
        .in('user_id', peerIds);

      // Get active outgoing intents for all peers
      const { data: outgoingIntents } = await supabase
        .from('drop_by_intents')
        .select('*, visitor:users!visitor_id(id, display_name)')
        .in('visitor_id', peerIds)
        .eq('status', 'active');

      // Get incoming intents (who is dropping by each peer)
      const { data: incomingIntents } = await supabase
        .from('drop_by_intents')
        .select('*, visitor:users!visitor_id(id, display_name, avatar_url)')
        .in('host_id', peerIds)
        .eq('status', 'active');

      const result: UserAvailability[] = Array.from(userMap.values()).map((peer) => {
        const peerWindows = (windows ?? [])
          .filter((w: any) => w.user_id === peer.id)
          .map((w: any) => ({ ...w, circle: w.circles })) as OpenWindow[];

        const peerOutgoing = (outgoingIntents ?? []).filter(
          (i: any) => i.visitor_id === peer.id
        ) as DropByIntent[];

        const peerIncoming = (incomingIntents ?? []).filter(
          (i: any) => i.host_id === peer.id
        ) as DropByIntent[];

        const status = computeStatus(peerWindows, peerOutgoing);
        const activeWindow = peerWindows.find((w) => isWindowActiveNow(w));

        return {
          user: peer,
          status,
          window: activeWindow,
          active_intent: peerOutgoing[0],
          incoming_intents: peerIncoming,
          label: statusLabel(status, peer.display_name),
        };
      });

      // Sort: free first, then dropping_by, then others
      result.sort((a, b) => {
        const order: Record<AvailabilityStatus, number> = {
          free: 0,
          dropping_by: 1,
          out_tonight: 2,
          unavailable: 3,
          no_window: 4,
        };
        return order[a.status] - order[b.status];
      });

      setAvailability(result);
    } catch (err) {
      console.error('useAvailability error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // Subscribe to real-time changes on the relevant tables
    const intentSub = supabase
      .channel('availability-intents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drop_by_intents' }, load)
      .subscribe();

    const windowSub = supabase
      .channel('availability-windows')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_windows' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(intentSub);
      supabase.removeChannel(windowSub);
    };
  }, [load]);

  return { availability, loading, refresh: load };
}

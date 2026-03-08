import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Notification } from '../types';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();

    // Subscribe to new notifications in real-time
    let userId: string;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      userId = user.id;
      const sub = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => load()
        )
        .subscribe();
      return () => { supabase.removeChannel(sub); };
    });
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications((data ?? []) as Notification[]);
      // Mark all as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
    } finally {
      setLoading(false);
    }
  }

  const icon = (type: Notification['type']) =>
    ({ drop_by_intent: '🚶', intent_cancelled: '↩️', window_conflict: '🌙', circle_invite: '👋' }[type] ?? '•');

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <View style={[styles.card, Shadow.card, !item.read && styles.unread]}>
      <Text style={styles.icon}>{icon(item.type)}</Text>
      <View style={styles.content}>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>
      {!item.read && <View style={styles.dot} />}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={Colors.blue} />
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>All quiet</Text>
          <Text style={styles.emptyBody}>
            You'll hear a gentle nudge when someone plans to drop by, or when something
            changes in your circles.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  headerTitle: { fontSize: 32, fontWeight: '800', color: Colors.navy },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  unread: { backgroundColor: Colors.skyBlue },
  icon: { fontSize: 24 },
  content: { flex: 1 },
  body: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  time: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.blue,
    marginTop: 6,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.navy },
  emptyBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

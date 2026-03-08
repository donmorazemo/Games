import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAvailability } from '../hooks/useAvailability';
import { createDropByIntent, cancelDropByIntent, getActiveIntentsForUser } from '../services/intents';
import { supabase } from '../lib/supabase';
import { UserAvailability, DropByIntent } from '../types';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';

export default function TonightScreen() {
  const { availability, loading, refresh } = useAvailability();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myIntents, setMyIntents] = useState<DropByIntent[]>([]);
  const params = useLocalSearchParams<{ magic?: string }>();
  const [showMagic, setShowMagic] = useState(params.magic === 'true');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
      if (user) loadMyIntents(user.id);
    });
  }, []);

  async function loadMyIntents(userId: string) {
    try {
      const intents = await getActiveIntentsForUser(userId);
      setMyIntents(intents);
    } catch (e) {
      console.warn('Could not load intents:', e);
    }
  }

  async function handleDropBy(item: UserAvailability) {
    const existing = myIntents.find((i) => i.host_id === item.user.id && i.status === 'active');
    if (existing) {
      Alert.alert(
        'Cancel drop by?',
        `Let ${item.user.display_name} know you're no longer coming?`,
        [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Cancel Drop By',
            style: 'destructive',
            onPress: async () => {
              try {
                await cancelDropByIntent(existing.id);
                refresh();
                if (currentUserId) loadMyIntents(currentUserId);
              } catch (e: any) {
                Alert.alert('Error', e.message);
              }
            },
          },
        ]
      );
      return;
    }
    if (!item.window) return;
    try {
      await createDropByIntent(item.user.id, item.window.id);
      refresh();
      if (currentUserId) loadMyIntents(currentUserId);
    } catch (e: any) {
      Alert.alert('Oops', e.message);
    }
  }

  const isDropping = (userId: string) =>
    myIntents.some((i) => i.host_id === userId && i.status === 'active');

  const renderCard = ({ item }: { item: UserAvailability }) => {
    const dropping = isDropping(item.user.id);
    const canDrop = item.status === 'free';
    const statusColor =
      item.status === 'free'
        ? Colors.free
        : item.status === 'dropping_by'
        ? Colors.dropping
        : Colors.out;

    return (
      <Pressable
        style={[styles.card, Shadow.card]}
        onPress={() => canDrop && handleDropBy(item)}
        disabled={!canDrop}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.avatar, { backgroundColor: Colors.blue }]}>
            <Text style={styles.avatarText}>
              {item.user.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.user.display_name}</Text>
            <Text style={[styles.cardStatus, { color: statusColor }]}>{item.label}</Text>
            {item.window && item.status === 'free' && (
              <Text style={styles.cardTime}>
                {item.window.start_time} – {item.window.end_time}
                {item.window.circle ? ` · ${item.window.circle.name}` : ''}
              </Text>
            )}
            {!!item.incoming_intents?.length && (
              <Text style={styles.cardIncoming}>
                {item.incoming_intents.map((i) => i.visitor?.display_name).join(', ')} dropping
                by
              </Text>
            )}
          </View>
        </View>
        {canDrop && (
          <View style={[styles.dropBtn, dropping && styles.dropBtnActive]}>
            <Text style={[styles.dropBtnText, dropping && styles.dropBtnTextActive]}>
              {dropping ? 'On my way' : 'Drop by'}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {showMagic && (
        <Pressable style={styles.magicBanner} onPress={() => setShowMagic(false)}>
          <Text style={styles.magicText}>
            🏡 You're already expected in some circles. Your friends are waiting.
          </Text>
        </Pressable>
      )}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tonight</Text>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={Colors.blue} />
      ) : availability.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🌙</Text>
          <Text style={styles.emptyTitle}>Quiet evening</Text>
          <Text style={styles.emptyBody}>
            No one in your circles has their door open tonight. Join or create a circle to get
            started.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/(tabs)/circles')}>
            <Text style={styles.emptyBtnText}>Find your circles</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={availability}
          keyExtractor={(item) => item.user.id}
          renderItem={renderCard}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  magicBanner: {
    backgroundColor: Colors.navy,
    padding: Spacing.md,
    margin: Spacing.md,
    borderRadius: Radius.md,
  },
  magicText: { color: Colors.white, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  headerTitle: { fontSize: 32, fontWeight: '800', color: Colors.navy },
  headerDate: { fontSize: 15, color: Colors.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.sm },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 20, fontWeight: '700' },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  cardStatus: { fontSize: 14, fontWeight: '500' },
  cardTime: { fontSize: 13, color: Colors.textMuted },
  cardIncoming: { fontSize: 12, color: Colors.blue, marginTop: 2 },
  dropBtn: {
    backgroundColor: Colors.skyBlue,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  dropBtnActive: { backgroundColor: Colors.navy },
  dropBtnText: { fontSize: 14, fontWeight: '600', color: Colors.blue },
  dropBtnTextActive: { color: Colors.white },
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
  emptyBtn: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    marginTop: Spacing.sm,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '600', fontSize: 15 },
});

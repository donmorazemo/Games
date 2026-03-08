import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getCircleMembers, inviteMemberByEmail, removeMember } from '../services/circles';
import { CircleMembership } from '../types';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';

export default function CircleDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const [members, setMembers] = useState<CircleMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getCircleMembers(id);
      setMembers(data);
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? '');
      setIsAdmin(data.some((m) => m.user_id === user?.id && m.role === 'admin'));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite() {
    if (!inviteEmail.trim() || !id) return;
    try {
      setInviting(true);
      await inviteMemberByEmail(id, inviteEmail.trim());
      setShowInvite(false);
      setInviteEmail('');
      load();
      Alert.alert('Invited', `${inviteEmail.trim()} has been added. They'll see your circle when they join Drop By.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(membership: CircleMembership) {
    if (!id) return;
    const isSelf = membership.user_id === currentUserId;
    const action = isSelf ? 'Leave circle?' : `Remove ${membership.user?.display_name}?`;
    const message = isSelf
      ? 'You will lose access to this circle.'
      : `${membership.user?.display_name} will no longer see your open hours in this circle.`;

    Alert.alert(action, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isSelf ? 'Leave' : 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(id, membership.user_id);
            if (isSelf) {
              router.back();
            } else {
              load();
            }
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  const renderMember = ({ item }: { item: CircleMembership }) => {
    const isSelf = item.user_id === currentUserId;
    const canManage = isAdmin || isSelf;

    return (
      <View style={[styles.memberCard, Shadow.card]}>
        <View style={[styles.avatar, { backgroundColor: Colors.blue }]}>
          <Text style={styles.avatarText}>
            {(item.user?.display_name ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {item.user?.display_name ?? 'Unknown'}
            {isSelf ? ' (you)' : ''}
          </Text>
          <Text style={styles.memberEmail}>{item.user?.email}</Text>
        </View>
        {item.role === 'admin' && <Text style={styles.adminBadge}>Admin</Text>}
        {canManage && (
          <Pressable onPress={() => handleRemove(item)} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>{isSelf ? 'Leave' : '✕'}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
        {isAdmin && (
          <Pressable style={styles.inviteBtn} onPress={() => setShowInvite(true)}>
            <Text style={styles.inviteBtnText}>+ Invite</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={Colors.blue} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderMember}
          refreshing={loading}
          onRefresh={load}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
          }
        />
      )}

      <Modal visible={showInvite} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite to {name}</Text>
            <Pressable onPress={() => { setShowInvite(false); setInviteEmail(''); }}>
              <Text style={styles.modalClose}>Cancel</Text>
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Enter their email. They'll be added when they join Drop By.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="friend@email.com"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleInvite}
          />
          <Pressable
            style={[styles.inviteConfirmBtn, !inviteEmail.trim() && { opacity: 0.4 }]}
            onPress={handleInvite}
            disabled={!inviteEmail.trim() || inviting}
          >
            {inviting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.inviteConfirmBtnText}>Send Invite</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  backBtnText: { fontSize: 28, color: Colors.navy, lineHeight: 32 },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '800', color: Colors.navy },
  inviteBtn: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  inviteBtnText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  memberCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  memberEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  adminBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.blue,
    backgroundColor: Colors.skyBlue,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  removeBtn: { padding: Spacing.xs },
  removeBtnText: { fontSize: 14, color: Colors.danger, fontWeight: '600' },
  modal: { flex: 1, padding: Spacing.lg, backgroundColor: Colors.white, gap: Spacing.md },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: Colors.navy },
  modalClose: { fontSize: 17, color: Colors.blue, fontWeight: '600' },
  modalBody: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 17,
    backgroundColor: Colors.offWhite,
  },
  inviteConfirmBtn: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  inviteConfirmBtnText: { color: Colors.white, fontWeight: '700', fontSize: 17 },
});

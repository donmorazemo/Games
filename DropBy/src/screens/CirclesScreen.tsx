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
import { router } from 'expo-router';
import { getMyCircles, createCircle } from '../services/circles';
import { Circle } from '../types';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';

export default function CirclesScreen() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setCircles(await getMyCircles());
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!newCircleName.trim()) return;
    try {
      setCreating(true);
      await createCircle(newCircleName.trim());
      setShowCreate(false);
      setNewCircleName('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  }

  const renderCircle = ({ item }: { item: Circle }) => (
    <Pressable
      style={[styles.card, Shadow.card]}
      onPress={() =>
        router.push({
          pathname: '/(tabs)/circles/[id]',
          params: { id: item.id, name: item.name },
        })
      }
    >
      <View style={styles.circleIcon}>
        <Text style={styles.circleEmoji}>◉</Text>
      </View>
      <View style={styles.circleInfo}>
        <Text style={styles.circleName}>{item.name}</Text>
        {item.my_role === 'admin' && <Text style={styles.roleLabel}>Admin</Text>}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Circles</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={Colors.blue} />
      ) : circles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>No circles yet</Text>
          <Text style={styles.emptyBody}>
            Create a circle for your college friends, family, or neighbours. Add them by
            email — they'll be expected when they join.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.emptyBtnText}>Create your first circle</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={circles}
          keyExtractor={(item) => item.id}
          renderItem={renderCircle}
          refreshing={loading}
          onRefresh={load}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
        />
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Circle</Text>
            <Pressable
              onPress={() => {
                setShowCreate(false);
                setNewCircleName('');
              }}
            >
              <Text style={styles.modalClose}>Cancel</Text>
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Name your circle — College Friends, Family, Neighbours.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Circle name"
            value={newCircleName}
            onChangeText={setNewCircleName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Pressable
            style={[styles.createBtn, !newCircleName.trim() && { opacity: 0.4 }]}
            onPress={handleCreate}
            disabled={!newCircleName.trim() || creating}
          >
            {creating ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.createBtnText}>Create Circle</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: { fontSize: 32, fontWeight: '800', color: Colors.navy },
  addBtn: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  addBtnText: { color: Colors.white, fontWeight: '600', fontSize: 15 },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  circleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.skyBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleEmoji: { fontSize: 20, color: Colors.blue },
  circleInfo: { flex: 1 },
  circleName: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  roleLabel: { fontSize: 12, color: Colors.blue, fontWeight: '500', marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.textMuted },
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
  modal: {
    flex: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    gap: Spacing.md,
  },
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
  createBtn: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createBtnText: { color: Colors.white, fontWeight: '700', fontSize: 17 },
});

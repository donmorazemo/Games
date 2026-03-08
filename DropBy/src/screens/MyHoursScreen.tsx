import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getMyWindows, createOpenWindow, deleteOpenWindow } from '../services/windows';
import { getMyCircles } from '../services/circles';
import { OpenWindow, Circle, DayOfWeek, DAY_LABELS } from '../types';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';

const DAYS: DayOfWeek[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0');
  return `${h}:00`;
});

export default function MyHoursScreen() {
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  // New window form state
  const [selectedCircle, setSelectedCircle] = useState('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('FR');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('21:00');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [w, c] = await Promise.all([getMyWindows(), getMyCircles()]);
      setWindows(w);
      setCircles(c);
      if (c.length > 0 && !selectedCircle) setSelectedCircle(c[0].id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!selectedCircle) {
      Alert.alert('Select a circle first');
      return;
    }
    const [startH] = startTime.split(':').map(Number);
    const [endH] = endTime.split(':').map(Number);
    if (endH <= startH) {
      Alert.alert('End time must be after start time');
      return;
    }
    try {
      setSaving(true);
      await createOpenWindow({
        circle_id: selectedCircle,
        rrule: `RRULE:FREQ=WEEKLY;BYDAY=${selectedDay}`,
        start_time: startTime,
        end_time: endTime,
      });
      setShowAdd(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(window: OpenWindow) {
    Alert.alert(
      'Remove open hours?',
      `Your ${DAY_LABELS[window.rrule.match(/BYDAY=([A-Z]+)/)?.[1] as DayOfWeek] ?? 'recurring'} window for ${window.circle?.name} will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOpenWindow(window.id);
              load();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  }

  const renderWindow = ({ item }: { item: OpenWindow }) => {
    const dayMatch = item.rrule.match(/BYDAY=([A-Z]+)/);
    const dayLabel = dayMatch ? DAY_LABELS[dayMatch[1] as DayOfWeek] ?? dayMatch[1] : '';

    return (
      <View style={[styles.windowCard, Shadow.card]}>
        <View style={styles.windowLeft}>
          <Text style={styles.windowDay}>{dayLabel}s</Text>
          <Text style={styles.windowTime}>
            {item.start_time} – {item.end_time}
          </Text>
          {item.circle && (
            <Text style={styles.windowCircle}>◉ {item.circle.name}</Text>
          )}
        </View>
        <View style={styles.windowRight}>
          <View style={styles.statusDot} />
          <Pressable onPress={() => handleDelete(item)} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Hours</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={Colors.blue} />
      ) : windows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🕰</Text>
          <Text style={styles.emptyTitle}>No open hours yet</Text>
          <Text style={styles.emptyBody}>
            Set recurring hours when friends can drop by. Each circle can have its own schedule.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.emptyBtnText}>Set open hours</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={windows}
          keyExtractor={(item) => item.id}
          renderItem={renderWindow}
          refreshing={loading}
          onRefresh={load}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Open Hours</Text>
            <Pressable onPress={() => setShowAdd(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>Circle</Text>
          {circles.length === 0 ? (
            <Text style={styles.noCirclesText}>
              Create a circle first before adding open hours.
            </Text>
          ) : (
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedCircle}
                onValueChange={(v) => setSelectedCircle(v)}
              >
                {circles.map((c) => (
                  <Picker.Item key={c.id} label={c.name} value={c.id} />
                ))}
              </Picker>
            </View>
          )}

          <Text style={styles.fieldLabel}>Day of week</Text>
          <View style={styles.dayRow}>
            {DAYS.map((d) => (
              <Pressable
                key={d}
                style={[styles.dayChip, selectedDay === d && styles.dayChipActive]}
                onPress={() => setSelectedDay(d)}
              >
                <Text style={[styles.dayChipText, selectedDay === d && styles.dayChipTextActive]}>
                  {d}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Start time</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={startTime} onValueChange={(v) => setStartTime(v)}>
              {HOURS.map((h) => (
                <Picker.Item key={h} label={h} value={h} />
              ))}
            </Picker>
          </View>

          <Text style={styles.fieldLabel}>End time</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={endTime} onValueChange={(v) => setEndTime(v)}>
              {HOURS.map((h) => (
                <Picker.Item key={h} label={h} value={h} />
              ))}
            </Picker>
          </View>

          <Pressable
            style={[styles.saveBtn, circles.length === 0 && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={circles.length === 0 || saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>Save Open Hours</Text>
            )}
          </Pressable>
        </ScrollView>
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
  windowCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  windowLeft: { gap: 3 },
  windowDay: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  windowTime: { fontSize: 15, color: Colors.textSecondary },
  windowCircle: { fontSize: 13, color: Colors.blue },
  windowRight: { alignItems: 'flex-end', gap: Spacing.sm },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.free,
  },
  deleteBtn: { padding: Spacing.xs },
  deleteBtnText: { fontSize: 13, color: Colors.danger, fontWeight: '500' },
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
  modal: { flex: 1, backgroundColor: Colors.white },
  modalContent: { padding: Spacing.lg, gap: Spacing.md },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: Colors.navy },
  modalClose: { fontSize: 17, color: Colors.blue, fontWeight: '600' },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
  },
  noCirclesText: { fontSize: 15, color: Colors.textSecondary, fontStyle: 'italic' },
  pickerWrapper: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.offWhite,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  dayChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  dayChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  dayChipTextActive: { color: Colors.white },
  saveBtn: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 17 },
});

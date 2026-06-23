import { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, fonts, spacing, radius, typography } from '../lib/theme';
import TimePicker, { format12h } from './TimePicker';
import DatePicker, { formatDateDisplay } from './DatePicker';

type Props = {
  visible: boolean;
  date: string | null;
  current: { status: 'available' | 'maybe'; start_time: string | null; end_time: string | null; notes: string | null } | null;
  onSave: (date: string, status: 'available' | 'maybe', startTime: string, endTime: string, notes: string) => void;
  onClear: () => void;
  onClose: () => void;
};

function formatDateLabel(dateStr: string | null) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
export default function AvailabilitySheet({ visible, date, current, onSave, onClear, onClose }: Props) {
  const [activeDate, setActiveDate] = useState<string | null>(date);
  const [status, setStatus] = useState<'available' | 'maybe'>('available');
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setActiveDate(date);
      setStatus(current?.status ?? 'available');
      setStartTime(current?.start_time?.slice(0, 5) ?? null);
      setEndTime(current?.end_time?.slice(0, 5) ?? null);
      setNotes(current?.notes ?? '');
    }
  }, [visible, current, date]);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <TouchableOpacity onPress={() => setDatePickerOpen(true)} style={styles.dateLabelBtn}>
              <Text style={styles.dateLabel}>{formatDateLabel(activeDate)}</Text>
              <Text style={styles.dateLabelEdit}>📅 Change</Text>
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>Availability</Text>
            <View style={styles.statusRow}>
              <TouchableOpacity
                style={[styles.statusBtn, status === 'available' && styles.statusBtnAvail]}
                onPress={() => setStatus('available')}
              >
                <Text style={styles.statusEmoji}>🟢</Text>
                <Text style={[styles.statusText, status === 'available' && { color: colors.offWhite }]}>Available</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusBtn, status === 'maybe' && styles.statusBtnMaybe]}
                onPress={() => setStatus('maybe')}
              >
                <Text style={styles.statusEmoji}>🟡</Text>
                <Text style={[styles.statusText, status === 'maybe' && { color: colors.offWhite }]}>Maybe</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>Time Window (optional)</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setStartPickerOpen(true)}>
                <Text style={[styles.timeBtnText, !startTime && styles.timePlaceholder]}>
                  {startTime ? format12h(startTime) : 'Start time'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.timeSep}>to</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setEndPickerOpen(true)}>
                <Text style={[styles.timeBtnText, !endTime && styles.timePlaceholder]}>
                  {endTime ? format12h(endTime) : 'End time'}
                </Text>
              </TouchableOpacity>
              {(startTime || endTime) && (
                <TouchableOpacity onPress={() => { setStartTime(null); setEndTime(null); }}>
                  <Text style={styles.clearTime}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Prefer morning, any course..."
              placeholderTextColor={colors.gray}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => activeDate && onSave(activeDate, status, startTime ?? '', endTime ?? '', notes)}
            >
              <Text style={styles.saveBtnText}>Save Availability</Text>
            </TouchableOpacity>

            {current && (
              <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
                <Text style={styles.clearBtnText}>Clear Availability</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TimePicker
        visible={startPickerOpen}
        value={startTime}
        title="Start Time"
        onConfirm={t => { setStartTime(t); setStartPickerOpen(false); }}
        onClose={() => setStartPickerOpen(false)}
      />
      <TimePicker
        visible={endPickerOpen}
        value={endTime}
        title="End Time"
        onConfirm={t => { setEndTime(t); setEndPickerOpen(false); }}
        onClose={() => setEndPickerOpen(false)}
      />
      <DatePicker
        visible={datePickerOpen}
        value={activeDate}
        title="Select Date"
        onConfirm={d => { setActiveDate(d); setDatePickerOpen(false); }}
        onClose={() => setDatePickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: 40,
    borderTopWidth: 1, borderColor: colors.hairline,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.inputBorder,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  dateLabelBtn: { alignItems: 'center', marginBottom: spacing.lg },
  dateLabel: { fontFamily: fonts.heading, fontSize: 22, color: colors.offWhite },
  dateLabelEdit: { fontSize: 12, color: colors.gold, fontFamily: fonts.bodyMedium, marginTop: 4 },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.sm },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statusBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: radius.md, padding: 12,
  },
  statusBtnAvail: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  statusBtnMaybe: { backgroundColor: '#5c4a00', borderColor: '#8B7A1A' },
  statusEmoji: { fontSize: 16 },
  statusText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.gray },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  timeBtn: {
    flex: 1, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center',
  },
  timeBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.offWhite },
  timePlaceholder: { color: colors.gray, fontFamily: fonts.body },
  timeSep: { color: colors.gray, fontFamily: fonts.body, fontSize: 14 },
  clearTime: { fontSize: 16, color: colors.gray, paddingHorizontal: 4 },

  notesInput: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.offWhite, fontFamily: fonts.body, fontSize: 14,
    minHeight: 64, marginBottom: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.emerald, borderRadius: radius.lg,
    paddingVertical: 15, alignItems: 'center', marginBottom: spacing.sm,
  },
  saveBtnText: { color: colors.offWhite, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  clearBtn: {
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: radius.lg,
    paddingVertical: 13, alignItems: 'center',
  },
  clearBtnText: { color: colors.danger, fontFamily: fonts.bodyMedium, fontSize: 14 },
});

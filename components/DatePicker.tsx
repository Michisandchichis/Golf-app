import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { colors, fonts, radius, spacing } from '../lib/theme';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export function formatDateDisplay(value: string | null | undefined): string {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function toStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildGrid(month: Date): (Date | null)[][] {
  const y = month.getFullYear(), m = month.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

type Props = {
  visible: boolean;
  value: string | null;
  title?: string;
  minDate?: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
};

export default function DatePicker({ visible, value, title, minDate, onConfirm, onClose }: Props) {
  const todayStr = toStr(new Date());
  const min = minDate ?? '';

  const initMonth = (v: string | null) => {
    const src = v ?? todayStr;
    const [y, m] = src.split('-').map(Number);
    return new Date(y, m - 1, 1);
  };

  const [month, setMonth] = useState(() => initMonth(value));
  const [selected, setSelected] = useState<string | null>(value);

  useEffect(() => {
    if (visible) {
      setSelected(value);
      setMonth(initMonth(value));
    }
  }, [visible]);

  const grid = buildGrid(month);

  function confirmSelected() {
    if (selected) onConfirm(selected);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title ?? 'Select Date'}</Text>
            <TouchableOpacity onPress={confirmSelected} disabled={!selected}>
              <Text style={[styles.done, !selected && { opacity: 0.35 }]}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            >
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </Text>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            >
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.dayRow}>
            {DAYS.map(d => (
              <View key={d} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {grid.map((row, ri) => (
              <View key={ri} style={styles.gridRow}>
                {row.map((date, ci) => {
                  if (!date) return <View key={ci} style={styles.cell} />;
                  const key = toStr(date);
                  const isPast = min ? key < min : false;
                  const isToday = key === todayStr;
                  const isSelected = key === selected;
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={[
                        styles.cell,
                        isSelected && styles.cellSelected,
                        !isSelected && isToday && styles.cellToday,
                        isPast && styles.cellPast,
                      ]}
                      onPress={() => { if (!isPast) setSelected(key); }}
                      disabled={isPast}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.cellText,
                        isSelected && styles.cellTextSelected,
                        !isSelected && isToday && { color: colors.gold },
                        isPast && styles.cellTextPast,
                      ]}>
                        {date.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Selected date display */}
          {selected && (
            <View style={styles.selectedRow}>
              <Text style={styles.selectedText}>{formatDateDisplay(selected)}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const CELL = 44;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: colors.hairline,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: colors.inputBorder,
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.hairline,
  },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.offWhite },
  cancel: { color: colors.gray, fontFamily: fonts.bodyMedium, fontSize: 15 },
  done: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 15 },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 28, color: colors.gold, lineHeight: 30 },
  monthLabel: { fontFamily: fonts.heading, fontSize: 20, color: colors.offWhite },

  dayRow: { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: 4 },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  dayHeaderText: { fontSize: 11, color: colors.gray, fontFamily: fonts.bodySemiBold, textTransform: 'uppercase' },

  grid: { paddingHorizontal: spacing.md },
  gridRow: { flexDirection: 'row', marginBottom: 4 },

  cell: {
    flex: 1, height: CELL, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm, margin: 1,
  },
  cellSelected: { backgroundColor: colors.gold },
  cellToday: { borderWidth: 1.5, borderColor: colors.gold },
  cellPast: { opacity: 0.25 },
  cellText: { fontSize: 15, color: colors.offWhite, fontFamily: fonts.bodyMedium },
  cellTextSelected: { color: colors.bg, fontFamily: fonts.bodySemiBold },
  cellTextPast: { color: colors.gray },

  selectedRow: {
    alignItems: 'center', paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.hairline,
    marginTop: spacing.sm, marginHorizontal: spacing.lg,
  },
  selectedText: { fontFamily: fonts.heading, fontSize: 16, color: colors.gold },
});

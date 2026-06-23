import { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { colors, fonts, radius, spacing } from '../lib/theme';

const ITEM_H = 50;
const VISIBLE = 5;
const PAD = ITEM_H * Math.floor(VISIBLE / 2);

const HOURS = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];
const PERIODS = ['AM','PM'];

export function format12h(value: string | null | undefined): string {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function parseToIdxs(value: string | null | undefined) {
  if (!value) return { hIdx: 6, mIdx: 0, pIdx: 0 };
  const [h, m] = value.split(':').map(Number);
  const pIdx = h >= 12 ? 1 : 0;
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const hIdx = HOURS.indexOf(String(hour12));
  const roundedMin = Math.round(m / 5) * 5 % 60;
  const mIdx = MINUTES.indexOf(String(roundedMin).padStart(2, '0'));
  return { hIdx: hIdx >= 0 ? hIdx : 6, mIdx: mIdx >= 0 ? mIdx : 0, pIdx };
}

function to24h(hIdx: number, mIdx: number, pIdx: number): string {
  const h = parseInt(HOURS[hIdx]);
  const m = parseInt(MINUTES[mIdx]);
  const h24 = pIdx === 0 ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function Wheel({ items, initIndex, onSelect, width }: {
  items: string[];
  initIndex: number;
  onSelect: (i: number) => void;
  width: number;
}) {
  const ref = useRef<ScrollView>(null);
  const lastY = useRef(initIndex * ITEM_H);
  const timer = useRef<any>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: initIndex * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, []);

  function snapTo(y: number) {
    const idx = Math.max(0, Math.min(Math.round(y / ITEM_H), items.length - 1));
    ref.current?.scrollTo({ y: idx * ITEM_H, animated: true });
    onSelect(idx);
  }

  function selectItem(i: number) {
    if (timer.current) clearTimeout(timer.current);
    ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
    onSelect(i);
  }

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: 'hidden' }}>
      <View style={styles.selectionBar} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: PAD }}
        scrollEventThrottle={16}
        onScroll={e => {
          lastY.current = e.nativeEvent.contentOffset.y;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => snapTo(lastY.current), 120);
        }}
        onScrollEndDrag={e => {
          if (timer.current) clearTimeout(timer.current);
          snapTo(e.nativeEvent.contentOffset.y);
        }}
        onMomentumScrollEnd={e => {
          if (timer.current) clearTimeout(timer.current);
          snapTo(e.nativeEvent.contentOffset.y);
        }}
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.item}
            onPress={() => selectItem(i)}
            activeOpacity={0.6}
          >
            <Text style={styles.itemText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

type Props = {
  visible: boolean;
  value: string | null;
  title?: string;
  onConfirm: (time: string) => void;
  onClose: () => void;
};

export default function TimePicker({ visible, value, title, onConfirm, onClose }: Props) {
  const init = parseToIdxs(value);
  const [hIdx, setHIdx] = useState(init.hIdx);
  const [mIdx, setMIdx] = useState(init.mIdx);
  const [pIdx, setPIdx] = useState(init.pIdx);

  useEffect(() => {
    if (visible) {
      const p = parseToIdxs(value);
      setHIdx(p.hIdx);
      setMIdx(p.mIdx);
      setPIdx(p.pIdx);
    }
  }, [visible]);

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
            {title ? <Text style={styles.title}>{title}</Text> : <View />}
            <TouchableOpacity onPress={() => onConfirm(to24h(hIdx, mIdx, pIdx))}>
              <Text style={styles.done}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.wheels}>
            <Wheel key={`h-${visible}`} items={HOURS} initIndex={hIdx} onSelect={setHIdx} width={68} />
            <Text style={styles.colon}>:</Text>
            <Wheel key={`m-${visible}`} items={MINUTES} initIndex={mIdx} onSelect={setMIdx} width={68} />
            <Wheel key={`p-${visible}`} items={PERIODS} initIndex={pIdx} onSelect={setPIdx} width={62} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingBottom: 36,
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

  wheels: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.lg, gap: 2,
  },
  colon: {
    fontSize: 26, color: colors.offWhite, fontFamily: fonts.bodySemiBold,
    marginBottom: 2, paddingHorizontal: 4,
  },

  selectionBar: {
    position: 'absolute',
    top: PAD,
    left: 0, right: 0,
    height: ITEM_H,
    backgroundColor: 'rgba(198,162,103,0.12)',
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(198,162,103,0.35)',
    zIndex: 1,
  },

  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: {
    fontSize: 22, color: colors.offWhite, fontFamily: fonts.bodySemiBold,
    letterSpacing: 0.5,
  },
});

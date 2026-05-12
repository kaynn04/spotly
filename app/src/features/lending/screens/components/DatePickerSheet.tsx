/**
 * DatePickerSheet
 *
 * Pure React Native drum-roll date picker — no native modules required.
 * Works in Expo Go and any managed/bare workflow without a prebuild.
 *
 * Shows a bottom-sheet modal with three scrollable columns (Month · Day · Year).
 */

import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5; // must be odd
const HALF = Math.floor(VISIBLE_ITEMS / 2);
const DRUM_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function buildYears(): number[] {
  const now = new Date().getFullYear();
  const years: number[] = [];
  for (let y = now; y <= now + 10; y++) years.push(y);
  return years;
}

// ─── Drum column ─────────────────────────────────────────────────────────────

interface DrumColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  textColor: string;
  subtleText: string;
}

function DrumColumn({ items, selectedIndex, onSelect, textColor, subtleText }: DrumColumnProps) {
  const ref = useRef<ScrollView>(null);

  // Scroll to position on mount / external change
  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [selectedIndex]);

  const handleMomentumEnd = useCallback(
    (e: any) => {
      const raw = e.nativeEvent.contentOffset.y / ITEM_HEIGHT;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(raw)));
      onSelect(idx);
      ref.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
    },
    [items.length, onSelect]
  );

  const handleScrollEnd = useCallback(
    (e: any) => {
      // Fallback for Android where momentumScrollEnd may not fire
      const raw = e.nativeEvent.contentOffset.y / ITEM_HEIGHT;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(raw)));
      onSelect(idx);
    },
    [items.length, onSelect]
  );

  return (
    <View style={styles.column}>
      <ScrollView
        ref={ref}
        style={{ height: DRUM_HEIGHT }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * HALF }}
        scrollEventThrottle={16}
      >
        {items.map((label, i) => (
          <View key={i} style={styles.drumItem}>
            <Text
              style={[
                styles.drumLabel,
                {
                  color: i === selectedIndex ? textColor : subtleText,
                  fontWeight: i === selectedIndex ? '600' : '400',
                  opacity: Math.abs(i - selectedIndex) > HALF ? 0.25 : 1,
                },
              ]}
            >
              {label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── DatePickerSheet ──────────────────────────────────────────────────────────

interface DatePickerSheetProps {
  visible: boolean;
  value: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  cardBg: string;
  borderColor: string;
  textColor: string;
  subtleText: string;
  isDark: boolean;
}

export default function DatePickerSheet({
  visible,
  value,
  minimumDate,
  onChange,
  onClose,
  cardBg,
  borderColor,
  textColor,
  subtleText,
  isDark,
}: DatePickerSheetProps) {
  const YEARS = buildYears();

  const monthIndex = value.getMonth();       // 0-11
  const day = value.getDate();               // 1-31
  const year = value.getFullYear();

  const yearIndex = Math.max(0, YEARS.indexOf(year));
  const maxDay = daysInMonth(monthIndex, year);
  const days = Array.from({ length: maxDay }, (_, i) => String(i + 1));

  const clampedDayIndex = Math.min(day - 1, maxDay - 1);

  const buildDate = useCallback(
    (mIdx: number, dIdx: number, yIdx: number): Date => {
      const y = YEARS[yIdx] ?? YEARS[0];
      const m = mIdx;
      const maxD = daysInMonth(m, y);
      const d = Math.min(dIdx + 1, maxD);
      const date = new Date(y, m, d);
      if (minimumDate && date < minimumDate) return minimumDate;
      return date;
    },
    [YEARS, minimumDate]
  );

  const handleMonth = useCallback(
    (idx: number) => onChange(buildDate(idx, clampedDayIndex, yearIndex)),
    [buildDate, clampedDayIndex, yearIndex, onChange]
  );
  const handleDay = useCallback(
    (idx: number) => onChange(buildDate(monthIndex, idx, yearIndex)),
    [buildDate, monthIndex, yearIndex, onChange]
  );
  const handleYear = useCallback(
    (idx: number) => onChange(buildDate(monthIndex, clampedDayIndex, idx)),
    [buildDate, monthIndex, clampedDayIndex, onChange]
  );

  const selectorBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: cardBg, borderTopColor: borderColor }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <Text style={[styles.title, { color: textColor }]}>Select Due Date</Text>
            <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Drum roll */}
          <View style={styles.drumWrapper}>
            {/* Selection highlight */}
            <View style={[styles.selectionBar, { backgroundColor: selectorBg, borderColor }]} pointerEvents="none" />

            <DrumColumn
              items={MONTHS}
              selectedIndex={monthIndex}
              onSelect={handleMonth}
              textColor={textColor}
              subtleText={subtleText}
            />
            <DrumColumn
              items={days}
              selectedIndex={clampedDayIndex}
              onSelect={handleDay}
              textColor={textColor}
              subtleText={subtleText}
            />
            <DrumColumn
              items={YEARS.map(String)}
              selectedIndex={yearIndex}
              onSelect={handleYear}
              textColor={textColor}
              subtleText={subtleText}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '700' },
  doneBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  doneBtnText: { fontSize: 16, fontWeight: '600', color: '#6b7f99' },

  drumWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  selectionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '50%',
    height: ITEM_HEIGHT,
    marginTop: -(ITEM_HEIGHT / 2),
    borderRadius: 10,
    borderWidth: 1,
  },

  column: {
    flex: 1,
    overflow: 'hidden',
  },
  drumItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drumLabel: {
    fontSize: 16,
  },
});

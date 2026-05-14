/**
 * DatePickerSheet
 *
 * Pure React Native drum-roll date picker — no native modules required.
 * Works in Expo Go and any managed/bare workflow without a prebuild.
 *
 * Shows a bottom-sheet modal with three scrollable columns (Month · Day · Year).
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
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

function buildYears(minimumDate?: Date): number[] {
  const start = minimumDate ? minimumDate.getFullYear() : new Date().getFullYear();
  const years: number[] = [];
  for (let y = start; y <= start + 10; y++) years.push(y);
  return years;
}

// ─── Drum column ─────────────────────────────────────────────────────────────

interface DrumColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  textColor: string;
  subtleText: string;
  disabledBefore?: number; // indexes < this value are shown faded
}

function DrumColumn({ items, selectedIndex, onSelect, textColor, subtleText, disabledBefore = 0 }: DrumColumnProps) {
  const ref = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const pendingSnapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMomentumRef = useRef(false);

  // Sync position when parent changes (e.g. minimumDate clamp snaps back)
  useEffect(() => {
    setActiveIndex(selectedIndex);
    ref.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [selectedIndex]);

  const snapTo = useCallback((rawY: number) => {
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(rawY / ITEM_HEIGHT)));
    setActiveIndex(idx);
    ref.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
    onSelect(idx);
  }, [items.length, onSelect]);

  const handleScroll = useCallback((e: any) => {
    const raw = e.nativeEvent.contentOffset.y / ITEM_HEIGHT;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(raw)));
    setActiveIndex(idx);
  }, [items.length]);

  const handleScrollEndDrag = useCallback((e: any) => {
    hasMomentumRef.current = false;
    const y = e.nativeEvent.contentOffset.y;
    // Wait briefly — if momentum starts, cancel this snap
    pendingSnapRef.current = setTimeout(() => {
      if (!hasMomentumRef.current) {
        snapTo(y);
      }
    }, 80);
  }, [snapTo]);

  const handleMomentumScrollBegin = useCallback(() => {
    hasMomentumRef.current = true;
    if (pendingSnapRef.current) {
      clearTimeout(pendingSnapRef.current);
      pendingSnapRef.current = null;
    }
  }, []);

  const handleMomentumScrollEnd = useCallback((e: any) => {
    hasMomentumRef.current = false;
    snapTo(e.nativeEvent.contentOffset.y);
  }, [snapTo]);

  return (
    <View style={styles.column}>
      <ScrollView
        ref={ref}
        style={{ height: DRUM_HEIGHT }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * HALF }}
        scrollEventThrottle={16}
      >
        {items.map((label, i) => {
          const isSelected = i === activeIndex;
          const isPast = i < disabledBefore;
          const distFromCenter = Math.abs(i - activeIndex);
          return (
            <View key={i} style={styles.drumItem}>
              <Text
                style={[
                  styles.drumLabel,
                  {
                    color: isPast ? subtleText : isSelected ? textColor : subtleText,
                    fontWeight: isSelected ? '600' : '400',
                    opacity: isPast ? 0.3 : distFromCenter > HALF ? 0.25 : 1,
                  },
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
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
  onConfirm: () => void;
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
  onConfirm,
  onClose,
  cardBg,
  borderColor,
  textColor,
  subtleText,
  isDark,
}: DatePickerSheetProps) {
  const YEARS = buildYears(minimumDate);

  // Normalize minimumDate to start of day for clean comparisons
  const minDay = minimumDate
    ? new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate())
    : undefined;

  const monthIndex = value.getMonth();
  const day = value.getDate();
  const year = value.getFullYear();

  const yearIndex = Math.max(0, YEARS.indexOf(year));
  const maxDay = daysInMonth(monthIndex, year);
  const days = Array.from({ length: maxDay }, (_, i) => String(i + 1));
  const clampedDayIndex = Math.min(day - 1, maxDay - 1);

  // Which indexes in each column are before the minimum date
  const minYear = minDay?.getFullYear() ?? 0;
  const minMonth = minDay?.getMonth() ?? 0;
  const minDate = minDay?.getDate() ?? 1;

  const disabledYearBefore = 0; // years start from minYear so none are disabled
  const disabledMonthBefore = year === minYear ? minMonth : 0;
  const disabledDayBefore =
    year === minYear && monthIndex === minMonth ? minDate - 1 : 0;

  const buildDate = useCallback(
    (mIdx: number, dIdx: number, yIdx: number): Date => {
      const y = YEARS[yIdx] ?? YEARS[0];
      const m = mIdx;
      const maxD = daysInMonth(m, y);
      const d = Math.min(dIdx + 1, maxD);
      const date = new Date(y, m, d);
      if (minDay && date < minDay) return new Date(minDay);
      return date;
    },
    [YEARS, minDay]
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
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: textColor }]}>Select Date</Text>
            <TouchableOpacity onPress={onConfirm} style={styles.doneBtn}>
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
              disabledBefore={disabledMonthBefore}
            />
            <DrumColumn
              items={days}
              selectedIndex={clampedDayIndex}
              onSelect={handleDay}
              textColor={textColor}
              subtleText={subtleText}
              disabledBefore={disabledDayBefore}
            />
            <DrumColumn
              items={YEARS.map(String)}
              selectedIndex={yearIndex}
              onSelect={handleYear}
              textColor={textColor}
              subtleText={subtleText}
              disabledBefore={disabledYearBefore}
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
  cancelBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#999' },
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

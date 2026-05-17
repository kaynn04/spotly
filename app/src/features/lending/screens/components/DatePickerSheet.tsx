/**
 * DatePickerSheet
 *
 * Calendar-style bottom sheet used by lending due dates and item warranties.
 * Pure React Native, so it works in Expo Go without native date picker modules.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft, faChevronRight, faCheck } from '@fortawesome/free-solid-svg-icons';

const PRIMARY = '#6b7f99';
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

type PickerPurpose = 'date' | 'due' | 'warranty';

interface QuickOption {
  label: string;
  date: Date;
}

interface DatePickerSheetProps {
  visible: boolean;
  value: Date;
  minimumDate?: Date;
  purpose?: PickerPurpose;
  onChange: (date: Date) => void;
  onConfirm: () => void;
  onClose: () => void;
  cardBg: string;
  borderColor: string;
  textColor: string;
  subtleText: string;
  isDark: boolean;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return startOfDay(next);
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return startOfDay(next);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isBeforeMonth(a: Date, b: Date): boolean {
  return a.getFullYear() < b.getFullYear()
    || (a.getFullYear() === b.getFullYear() && a.getMonth() < b.getMonth());
}

function buildCalendarDays(displayMonth: Date): Date[] {
  const firstDay = startOfMonth(displayMonth);
  const gridStart = addDays(firstDay, -firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function clampToMinimum(date: Date, minDay?: Date): Date {
  const cleanDate = startOfDay(date);
  return minDay && cleanDate < minDay ? new Date(minDay) : cleanDate;
}

function getTitle(purpose: PickerPurpose): string {
  if (purpose === 'due') return 'Due Date';
  if (purpose === 'warranty') return 'Warranty Expiry';
  return 'Select Date';
}

function getConfirmLabel(purpose: PickerPurpose): string {
  if (purpose === 'due') return 'Set Due Date';
  if (purpose === 'warranty') return 'Set Warranty';
  return 'Set Date';
}

function getQuickOptions(purpose: PickerPurpose, today: Date): QuickOption[] {
  if (purpose === 'due') {
    return [
      { label: 'Today', date: today },
      { label: 'Tomorrow', date: addDays(today, 1) },
      { label: '1 week', date: addDays(today, 7) },
      { label: '2 weeks', date: addDays(today, 14) },
    ];
  }

  if (purpose === 'warranty') {
    return [
      { label: '30 days', date: addDays(today, 30) },
      { label: '90 days', date: addDays(today, 90) },
      { label: '1 year', date: addYears(today, 1) },
      { label: '2 years', date: addYears(today, 2) },
    ];
  }

  return [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: '1 week', date: addDays(today, 7) },
    { label: '1 month', date: addMonths(today, 1) },
  ];
}

function getRelativeLabel(selectedDay: Date, today: Date): string {
  const dayDiff = Math.round((selectedDay.getTime() - today.getTime()) / DAY_MS);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  if (dayDiff > 1) return `In ${dayDiff} days`;
  if (dayDiff === -1) return 'Yesterday';
  return `${Math.abs(dayDiff)} days ago`;
}

export default function DatePickerSheet({
  visible,
  value,
  minimumDate,
  purpose = 'date',
  onChange,
  onConfirm,
  onClose,
  cardBg,
  borderColor,
  textColor,
  subtleText,
  isDark,
}: DatePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const today = useMemo(() => startOfDay(new Date()), []);
  const minDay = useMemo(
    () => minimumDate ? startOfDay(minimumDate) : undefined,
    [minimumDate]
  );
  const selectedDay = useMemo(() => clampToMinimum(value, minDay), [value, minDay]);
  const [displayMonth, setDisplayMonth] = useState(startOfMonth(selectedDay));

  useEffect(() => {
    if (visible) {
      setDisplayMonth(startOfMonth(selectedDay));
    }
  }, [selectedDay, visible]);

  const days = useMemo(() => buildCalendarDays(displayMonth), [displayMonth]);
  const quickOptions = useMemo(
    () => getQuickOptions(purpose, today).map((option) => ({
      ...option,
      date: clampToMinimum(option.date, minDay),
    })),
    [minDay, purpose, today]
  );

  const canGoPrevious = useMemo(() => {
    if (!minDay) return true;
    return !isBeforeMonth(addMonths(displayMonth, -1), startOfMonth(minDay));
  }, [displayMonth, minDay]);

  const selectDate = useCallback((date: Date) => {
    const nextDate = clampToMinimum(date, minDay);
    onChange(nextDate);
    setDisplayMonth(startOfMonth(nextDate));
  }, [minDay, onChange]);

  const moveMonth = useCallback((amount: number) => {
    setDisplayMonth((current) => {
      const nextMonth = addMonths(current, amount);
      if (amount < 0 && minDay && isBeforeMonth(nextMonth, startOfMonth(minDay))) {
        return current;
      }
      return nextMonth;
    });
  }, [minDay]);

  const selectedLabel = FULL_DATE_FORMATTER.format(selectedDay);
  const relativeLabel = getRelativeLabel(selectedDay, today);
  const title = getTitle(purpose);
  const confirmLabel = getConfirmLabel(purpose);
  const selectedBg = isDark ? 'rgba(107,127,153,0.28)' : 'rgba(107,127,153,0.14)';
  const softBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const isCompact = height < 720 || width < 360;
  const horizontalPadding = isCompact ? 14 : 18;
  const daySize = isCompact ? 30 : 34;
  const dayRadius = daySize / 2;
  const dayCellHeight = isCompact ? 36 : 42;
  const sheetMaxHeight = Math.min(height * 0.92, 660);
  const contentMaxHeight = Math.max(320, sheetMaxHeight - 150 - insets.bottom);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: cardBg, borderTopColor: borderColor, maxHeight: sheetMaxHeight, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.handle} />

          <View style={[styles.header, { borderBottomColor: borderColor, paddingHorizontal: horizontalPadding }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerTextButton}>
              <Text style={[styles.headerText, { color: subtleText }]}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onConfirm} style={styles.headerTextButton}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: contentMaxHeight }}
            contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.selectedCard, { backgroundColor: selectedBg, borderColor }]}>
              <View style={styles.selectedTextWrap}>
                <Text style={[styles.selectedDate, { color: textColor }]} numberOfLines={1}>
                  {selectedLabel}
                </Text>
                <Text style={[styles.relativeDate, { color: subtleText }]}>{relativeLabel}</Text>
              </View>
              <View style={styles.selectedIcon}>
                <FontAwesomeIcon icon={faCheck} size={12} color="#ffffff" />
              </View>
            </View>

            <View style={styles.quickRow}>
              {quickOptions.map((option) => {
                const isSelected = isSameDay(option.date, selectedDay);
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.quickChip,
                      {
                        backgroundColor: isSelected ? PRIMARY : softBg,
                        borderColor: isSelected ? PRIMARY : borderColor,
                      },
                    ]}
                    onPress={() => selectDate(option.date)}
                  >
                    <Text style={[styles.quickChipText, { color: isSelected ? '#ffffff' : textColor }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.monthNav}>
              <TouchableOpacity
                onPress={() => moveMonth(-1)}
                disabled={!canGoPrevious}
                style={[styles.navButton, { backgroundColor: softBg, opacity: canGoPrevious ? 1 : 0.35 }]}
              >
                <FontAwesomeIcon icon={faChevronLeft} size={14} color={canGoPrevious ? textColor : subtleText} />
              </TouchableOpacity>
              <Text style={[styles.monthTitle, { color: textColor }]}>{MONTH_FORMATTER.format(displayMonth)}</Text>
              <TouchableOpacity onPress={() => moveMonth(1)} style={[styles.navButton, { backgroundColor: softBg }]}>
                <FontAwesomeIcon icon={faChevronRight} size={14} color={textColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((day, index) => (
                <Text key={`${day}-${index}`} style={[styles.weekLabel, { color: subtleText }]}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {days.map((date) => {
                const isCurrentMonth = date.getMonth() === displayMonth.getMonth();
                const isSelected = isSameDay(date, selectedDay);
                const isToday = isSameDay(date, today);
                const isDisabled = !!minDay && date < minDay;

                return (
                  <TouchableOpacity
                    key={date.toISOString()}
                    style={[styles.dayCell, { height: dayCellHeight }]}
                    disabled={isDisabled}
                    onPress={() => selectDate(date)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        { width: daySize, height: daySize, borderRadius: dayRadius },
                        isSelected && { backgroundColor: PRIMARY },
                        !isSelected && isToday && { borderColor: PRIMARY, borderWidth: 1.5 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          { color: isCurrentMonth ? textColor : subtleText },
                          isSelected && styles.selectedDayText,
                          isDisabled && { color: subtleText, opacity: 0.35 },
                          !isSelected && !isDisabled && isToday && { color: PRIMARY, fontWeight: '700' },
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: borderColor, paddingHorizontal: horizontalPadding }]}>
            <TouchableOpacity style={styles.primaryButton} onPress={onConfirm}>
              <Text style={styles.primaryButtonText}>{confirmLabel}</Text>
            </TouchableOpacity>
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
    paddingBottom: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.45)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTextButton: {
    minWidth: 64,
    minHeight: 36,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 15,
    fontWeight: '600',
  },
  doneText: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  selectedCard: {
    minHeight: 68,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedTextWrap: {
    flex: 1,
  },
  selectedDate: {
    fontSize: 16,
    fontWeight: '700',
  },
  relativeDate: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: '500',
  },
  selectedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  quickChip: {
    flexGrow: 1,
    minWidth: '22%',
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedDayText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    marginTop: 8,
    borderTopWidth: 1,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

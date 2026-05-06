/**
 * Lending History Screen
 *
 * Minimalist redesign â€” uniform with Outside feature
 *
 * Feature: 009 - Lending Tracker
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { LendingService } from '../services/LendingService';
import { LendingRepository } from '../repositories/LendingRepository';
import { ItemRepository } from '../../../repositories/ItemRepository';
import { Lending } from '../models/Lending';

const PRIMARY = '#6b7f99';
const SUCCESS = '#6b9e7a';

type FilterType = 'ALL' | 'ACTIVE' | 'RETURNED';

export default function LendingHistoryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const repositories = useMemo(() => ({
    lendingRepository: new LendingRepository(),
    itemRepository: new ItemRepository(),
  }), []);

  const lendingService = useMemo(() =>
    new LendingService(repositories.lendingRepository, repositories.itemRepository),
    [repositories]
  );

  const [allLendings, setAllLendings] = useState<(Lending & { itemName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('ALL');

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  const loadAllLendings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const lendings = await lendingService.getAllLendings();
      const lendingsWithItems = await Promise.all(
        lendings.map(async (lending) => {
          try {
            const item = await repositories.itemRepository.getById(lending.item_id);
            return { ...lending, itemName: item?.name || 'Unknown Item' };
          } catch {
            return { ...lending, itemName: 'Unknown Item' };
          }
        })
      );
      const sorted = [...lendingsWithItems].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
        return new Date(b.lent_at).getTime() - new Date(a.lent_at).getTime();
      });
      setAllLendings(sorted);
    } catch (err: any) {
      setError(err?.message || 'Failed to load lending history');
    } finally {
      setLoading(false);
    }
  }, [lendingService, repositories.itemRepository]);

  useFocusEffect(useCallback(() => { loadAllLendings(); }, [loadAllLendings]));

  const filteredLendings = selectedFilter === 'ALL'
    ? allLendings
    : allLendings.filter((l) => l.status === selectedFilter);

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderLendingItem = ({ item, index }: { item: Lending & { itemName?: string }, index: number }) => {
    const isActive = item.status === 'ACTIVE';
    const dotColor = isActive ? PRIMARY : SUCCESS;

    return (
      <TouchableOpacity
        style={[
          styles.lendingRow,
          index < filteredLendings.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
        ]}
        onPress={() => router.push(`/lending/${item.id}`)}
        activeOpacity={0.6}
      >
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <View style={styles.lendingRowContent}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
            {item.itemName || 'Unknown Item'}
          </Text>
          <Text style={[styles.borrowerName, { color: subtleText }]} numberOfLines={1}>
            Lent to {item.borrower_name}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.statusPill, { backgroundColor: isActive ? `${PRIMARY}18` : `${SUCCESS}18` }]}>
              <Text style={[styles.statusPillText, { color: isActive ? PRIMARY : SUCCESS }]}>
                {isActive ? 'Active' : 'Returned'}
              </Text>
            </View>
            <Text style={[styles.dateText, { color: subtleText }]}>{formatDate(item.lent_at)}</Text>
          </View>
        </View>
        <Text style={[styles.chevron, { color: subtleText }]}>â€º</Text>
      </TouchableOpacity>
    );
  };

  const headerBar = (
    <View style={[styles.headerBar, { borderBottomColor: borderColor, paddingTop: insets.top }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={[styles.backBtnText, { color: PRIMARY }]}>â€¹ Back</Text>
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>History</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
        {headerBar}
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
        {headerBar}
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: '#d32f2f' }]}>{error}</Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: PRIMARY }]} onPress={loadAllLendings}>
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      {headerBar}

      {/* Filter Pills */}
      <View style={[styles.filterRow, { borderBottomColor: borderColor }]}>
        {(['ALL', 'ACTIVE', 'RETURNED'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterPill,
              selectedFilter === f && { backgroundColor: PRIMARY },
              selectedFilter !== f && { backgroundColor: isDark ? '#2c2c2e' : '#e2e6ea' },
            ]}
            onPress={() => setSelectedFilter(f)}
          >
            <Text style={[
              styles.filterPillText,
              { color: selectedFilter === f ? '#fff' : subtleText },
            ]}>
              {f === 'ALL' ? 'All' : f === 'ACTIVE' ? 'Active' : 'Returned'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {filteredLendings.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>ðŸ•“</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No records</Text>
          <Text style={[styles.emptySubtitle, { color: subtleText }]}>
            {selectedFilter === 'ACTIVE' ? 'No active lendings' : selectedFilter === 'RETURNED' ? 'No returned items yet' : 'No lending history yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredLendings}
          renderItem={renderLendingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { paddingVertical: 8, paddingRight: 8 },
  backBtnText: { fontSize: 17, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSpacer: { width: 60 },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterPillText: { fontSize: 13, fontWeight: '600' },

  listContent: { paddingHorizontal: 16, paddingVertical: 8 },

  lendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  lendingRowContent: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  borrowerName: { fontSize: 13, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusPillText: { fontSize: 11, fontWeight: '600' },
  dateText: { fontSize: 12 },
  chevron: { fontSize: 22 },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  errorText: { fontSize: 15, marginBottom: 16, textAlign: 'center' },
  primaryButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

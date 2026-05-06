/**
 * Lending History Screen
 *
 * Display history of all lendings (ACTIVE and RETURNED).
 * Allow filtering by status and view individual lending details.
 *
 * Architecture: UI → Service → Repository → SQLite
 * State: Local (allLendings, loading, error, selectedFilter)
 *
 * Feature: 009 - Lending Tracker
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LendingService } from '../services/LendingService';
import { LendingRepository } from '../repositories/LendingRepository';
import { ItemRepository } from '../../../repositories/ItemRepository';
import { Lending } from '../models/Lending';
import { Colors } from '@/constants/theme';

type FilterType = 'ALL' | 'ACTIVE' | 'RETURNED';

/**
 * LendingHistoryScreen Component
 *
 * Shows:
 * - All lendings (ACTIVE + RETURNED)
 * - Filter tabs for status
 * - List with lending details and status badges
 * - Navigation to detail screen
 * - Loading/error states
 * - Empty state per filter
 *
 * State Management:
 * - allLendings: All lending records
 * - loading: Loading state for data fetch
 * - error: Error message if fetch fails
 * - selectedFilter: Current filter (ALL/ACTIVE/RETURNED)
 */
export default function LendingHistoryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Services - memoized to prevent re-creation on every render
  const lendingService = useMemo(() => {
    const lendingRepository = new LendingRepository();
    const itemRepository = new ItemRepository();
    return new LendingService(lendingRepository, itemRepository);
  }, []);

  // State
  const [allLendings, setAllLendings] = useState<Lending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('ALL');

  /**
   * Load All Lendings
   *
   * Fetch all lendings from service and sort appropriately.
   * Sorting: ACTIVE first, then by date descending (most recent first)
   */
  const loadAllLendings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all lendings
      const lendings = await lendingService.getAllLendings();

      // Sort: ACTIVE before RETURNED, then by date descending
      const sorted = [...lendings].sort((a, b) => {
        // First: ACTIVE before RETURNED
        if (a.status !== b.status) {
          return a.status === 'ACTIVE' ? -1 : 1;
        }
        // Second: Most recent first
        const dateA = new Date(a.lent_at).getTime();
        const dateB = new Date(b.lent_at).getTime();
        return dateB - dateA;
      });

      setAllLendings(sorted);
    } catch (err: any) {
      console.error('Error loading lendings:', err);
      setError(err?.message || 'Failed to load lending history');
    } finally {
      setLoading(false);
    }
  }, [lendingService]);

  // Load on mount and on screen focus
  useFocusEffect(
    useCallback(() => {
      loadAllLendings();
    }, [loadAllLendings])
  );

  /**
   * Get Filtered Lendings
   *
   * Filter lendings based on selected filter.
   */
  const getFilteredLendings = (): Lending[] => {
    if (selectedFilter === 'ALL') {
      return allLendings;
    }
    return allLendings.filter((lending) => lending.status === selectedFilter);
  };

  /**
   * Handle Lending Tap
   *
   * Navigate to detail screen with lending ID.
   */
  const handleLendingTap = (lending: Lending) => {
    router.push(`/lending/${lending.id}`);
  };

  /**
   * Format Date
   *
   * Display date in readable format.
   */
  const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A';
    return date instanceof Date
      ? date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : new Date(date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  };

  /**
   * Render Filter Tab
   *
   * Tab button for status filter.
   */
  const renderFilterTab = (filter: FilterType, label: string) => {
    const isSelected = selectedFilter === filter;
    return (
      <Pressable
        key={filter}
        style={[
          styles.filterTab,
          isSelected && { borderBottomColor: colors.tint, borderBottomWidth: 2 },
        ]}
        onPress={() => setSelectedFilter(filter)}
      >
        <Text
          style={[
            styles.filterTabText,
            { color: isSelected ? colors.tint : colors.tabIconDefault },
            isSelected && { fontWeight: '700' },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  /**
   * Render Lending Item
   *
   * List item component showing lending details.
   */
  const renderLendingItem = ({ item }: { item: Lending }) => {
    const isActive = item.status === 'ACTIVE';
    const statusColor = isActive ? '#4caf50' : '#9e9e9e';

    return (
      <Pressable
        style={[styles.lendingCard, { borderColor: colors.border }]}
        onPress={() => handleLendingTap(item)}
      >
        <View style={styles.lendingCardContent}>
          {/* Borrower Name */}
          <Text style={[styles.borrowerName, { color: colors.text }]} numberOfLines={1}>
            {item.borrower_name}
          </Text>

          {/* Status Badge and Date Info */}
          <View style={styles.metaRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusBadgeText}>{isActive ? 'ACTIVE' : 'RETURNED'}</Text>
            </View>
            <Text style={[styles.dateText, { color: colors.tabIconDefault }]}>
              {formatDate(item.lent_at)}
            </Text>
          </View>

          {/* Note Preview (if exists) */}
          {item.note && (
            <Text style={[styles.notePreview, { color: colors.tabIconDefault }]} numberOfLines={1}>
              Note: {item.note}
            </Text>
          )}

          {/* Returned Date (if returned) */}
          {!isActive && item.returned_at && (
            <Text style={[styles.returnedDateText, { color: colors.tabIconDefault }]}>
              Returned: {formatDate(item.returned_at)}
            </Text>
          )}
        </View>

        {/* Chevron */}
        <Text style={[styles.chevron, { color: colors.tabIconDefault }]}>›</Text>
      </Pressable>
    );
  };

  /**
   * Render Empty State
   *
   * Show message when no lendings match filter.
   */
  const renderEmptyState = () => {
    const filteredCount = getFilteredLendings().length;
    if (filteredCount > 0) return null;

    let message = 'No lending history';
    if (selectedFilter === 'ACTIVE') {
      message = 'No active lendings';
    } else if (selectedFilter === 'RETURNED') {
      message = 'No returned items';
    }

    return (
      <View style={styles.emptyStateContainer}>
        <Text style={[styles.emptyStateText, { color: colors.tabIconDefault }]}>
          {message}
        </Text>
      </View>
    );
  };

  const filteredLendings = getFilteredLendings();

  // Render Loading
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.backButton, { color: colors.tint }]}>← Back</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>History</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render Error
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.backButton, { color: colors.tint }]}>← Back</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>History</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <Text style={[styles.errorText, { color: colors.error || '#d32f2f' }]}>{error}</Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
            onPress={loadAllLendings}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backButton, { color: colors.tint }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { borderBottomColor: colors.border }]}>
        {renderFilterTab('ALL', 'All')}
        {renderFilterTab('ACTIVE', 'Active')}
        {renderFilterTab('RETURNED', 'Returned')}
      </View>

      {/* Lendings List */}
      <FlatList
        data={filteredLendings}
        renderItem={renderLendingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        scrollEnabled={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  filterContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  filterTab: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  lendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#f9f9f9',
  },
  lendingCardContent: {
    flex: 1,
  },
  borrowerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 12,
  },
  notePreview: {
    fontSize: 12,
    marginBottom: 4,
  },
  returnedDateText: {
    fontSize: 12,
  },
  chevron: {
    fontSize: 24,
    marginLeft: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
  },
});

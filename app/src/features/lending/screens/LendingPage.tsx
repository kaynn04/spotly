/**
 * Lending Page
 *
 * Main lending tab screen where users can:
 * - View active lendings (items they've lent out)
 * - Lend a new item
 * - Navigate to lending details
 *
 * Architecture: UI → Service → Repository → SQLite
 * State: Local (lendings, modals, loading/error)
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { LendingService } from '../services/LendingService';
import { LendingRepository } from '../repositories/LendingRepository';
import { ItemRepository } from '../../../repositories/ItemRepository';
import { Lending } from '../models/Lending';

/**
 * LendingPage Component
 *
 * Main lending tab showing:
 * - List of active lendings (items currently lent)
 * - Link to view lending history
 * - Lending creation is handled from item options (move/delete)
 *
 * State Management:
 * - lendings: Array of Lending records with item names
 * - loading: Loading state for data fetch
 * - error: Error message if fetch fails
 *
 * Flow:
 * 1. On screen focus, load active lendings with item names
 * 2. User taps on a lending to see details
 * 3. User accesses "Lend Item" from item options in spaces
 */
export default function LendingPage() {
  const router = useRouter();

  // Service instances - memoized to prevent re-creation on every render
  const repositories = useMemo(() => {
    const lendingRepository = new LendingRepository();
    const itemRepository = new ItemRepository();
    return { lendingRepository, itemRepository };
  }, []);

  const lendingService = useMemo(() => {
    return new LendingService(repositories.lendingRepository, repositories.itemRepository);
  }, [repositories]);

  // Data state - store lendings with item names
  const [lendings, setLendings] = useState<(Lending & { itemName?: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load Active Lendings with Item Names
   *
   * Fetches active lendings from service, then loads item names
   * Called on mount and after screen focus
   */
  const loadLendings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeLendings = await lendingService.getActiveLendings();
      
      // Load item names for each lending
      const lendingsWithItems = await Promise.all(
        activeLendings.map(async (lending) => {
          try {
            const item = await repositories.itemRepository.getById(lending.item_id);
            return {
              ...lending,
              itemName: item?.name || 'Unknown Item',
            };
          } catch (err) {
            console.error(`Failed to load item for lending ${lending.id}:`, err);
            return {
              ...lending,
              itemName: 'Unknown Item',
            };
          }
        })
      );
      
      setLendings(lendingsWithItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load lendings');
      console.error('Error loading lendings:', err);
    } finally {
      setLoading(false);
    }
  }, [lendingService, repositories.itemRepository]);

  // Load lendings on screen focus
  useFocusEffect(
    useCallback(() => {
      loadLendings();
    }, [loadLendings])
  );

  /**
   * Handle Lending Tap
   *
   * User tapped on a lending in the list.
   * Navigate to detail screen with lending ID.
   */
  const handleLendingTap = (lending: Lending) => {
    router.push(`/lending/${lending.id}`);
  };

  /**
   * Handle See History Button
   *
   * Navigate to lending history screen.
   */
  const handleSeeHistory = () => {
    router.push('/lending/history');
  };

  /**
   * Render Lending Item
   *
   * List item component showing lending details with item name.
   */
  const renderLendingItem = ({ item }: { item: Lending & { itemName?: string } }) => (
    <Pressable
      style={styles.lendingCard}
      onPress={() => handleLendingTap(item)}
    >
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.itemName || 'Unknown Item'}
        </Text>
        <Text style={styles.cardSubtitle}>
          Borrowed by: {item.borrower_name}
        </Text>
        <Text style={styles.cardMeta}>
          Lent on {new Date(item.lent_at).toLocaleDateString()}
        </Text>
        {item.note && (
          <Text style={styles.cardNote} numberOfLines={2}>
            Note: {item.note}
          </Text>
        )}
      </View>
      <Text style={styles.cardArrow}>›</Text>
    </Pressable>
  );

  /**
   * Render Empty State
   *
   * Message when no active lendings exist.
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No active lendings</Text>
      <Text style={styles.emptyMessage}>
        Select an item and tap "Lend" to lend something to a friend
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with actions */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lendings</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.historyButton}
            onPress={handleSeeHistory}
          >
            <Text style={styles.historyButtonText}>History</Text>
          </Pressable>
        </View>
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading indicator */}
      {loading && !lendings.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : (
        <>
          {/* Lendings list */}
          <FlatList
            data={lendings}
            renderItem={renderLendingItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.listContent}
            scrollEnabled={lendings.length > 0}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  historyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0a7ea4',
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ef5350',
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  lendingCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  cardNote: {
    fontSize: 12,
    color: '#555',
    fontStyle: 'italic',
    marginTop: 4,
  },
  cardArrow: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

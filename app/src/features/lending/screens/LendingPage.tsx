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
import ItemSelectionModal from './components/ItemSelectionModal';
import LendingFormModal from './components/LendingFormModal';

/**
 * LendingPage Component
 *
 * Main lending tab showing:
 * - List of active lendings (items currently lent)
 * - Button to lend a new item
 * - Link to view lending history
 *
 * State Management:
 * - lendings: Array of Lending records
 * - loading: Loading state for data fetch
 * - error: Error message if fetch fails
 * - showItemModal: Show/hide item selection modal
 * - showFormModal: Show/hide borrower form
 * - selectedItem: Selected item for new lending
 *
 * Flow:
 * 1. On screen focus, load active lendings
 * 2. User taps "Lend Item"
 * 3. Item selection modal opens
 * 4. User selects item
 * 5. Form modal opens
 * 6. User enters borrower name and note
 * 7. Submit creates lending via service
 * 8. List refreshes automatically
 */
export default function LendingPage() {
  const router = useRouter();

  // Service instances - memoized to prevent re-creation on every render
  const lendingService = useMemo(() => {
    const lendingRepository = new LendingRepository();
    const itemRepository = new ItemRepository();
    return new LendingService(lendingRepository, itemRepository);
  }, []);

  // Data state
  const [lendings, setLendings] = useState<Lending[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showItemModal, setShowItemModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Form state
  const [borrowerName, setBorrowerName] = useState('');
  const [note, setNote] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  /**
   * Load Active Lendings
   *
   * Fetches active lendings from service.
   * Called on mount and after successful lending creation.
   */
  const loadLendings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await lendingService.getActiveLendings();
      setLendings(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load lendings');
      console.error('Error loading lendings:', err);
    } finally {
      setLoading(false);
    }
  }, [lendingService]);

  // Load lendings on screen focus
  useFocusEffect(
    useCallback(() => {
      loadLendings();
    }, [loadLendings])
  );

  /**
   * Handle Item Selection
   *
   * User selected an item from the modal.
   * Close item modal, set selected item, open form modal.
   */
  const handleItemSelected = (item: any) => {
    setShowItemModal(false);
    setSelectedItem(item);
    setShowFormModal(true);
  };

  /**
   * Handle Form Submission
   *
   * Create lending with selected item and form data.
   * Validate borrower name, call service, refresh list.
   */
  const handleFormSubmit = async () => {
    // Validate
    if (!borrowerName.trim()) {
      Alert.alert('Required', 'Please enter a borrower name');
      return;
    }

    setFormLoading(true);
    try {
      await lendingService.createLending({
        item_id: selectedItem.id,
        borrower_name: borrowerName.trim(),
        note: note.trim() || undefined,
      });

      // Success feedback
      Alert.alert('Success', 'Item lent out successfully');

      // Reset form
      setBorrowerName('');
      setNote('');
      setSelectedItem(null);
      setShowFormModal(false);

      // Reload list
      await loadLendings();
    } catch (err: any) {
      console.error('Error creating lending:', err);
      const errorMessage = err.code === 'DUPLICATE_ACTIVE_LENDING'
        ? 'Item is already lent out'
        : err.message || 'Failed to create lending';
      Alert.alert('Error', errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * Handle Form Cancel
   *
   * User cancelled the form.
   * Reset state and close modals.
   */
  const handleFormCancel = () => {
    setBorrowerName('');
    setNote('');
    setSelectedItem(null);
    setShowFormModal(false);
  };

  /**
   * Handle Item Tap
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
   * List item component showing lending details.
   */
  const renderLendingItem = ({ item }: { item: Lending }) => (
    <Pressable
      style={styles.lendingCard}
      onPress={() => handleLendingTap(item)}
    >
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {selectedItem?.name || 'Item'}
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
        Tap "Lend Item" to lend something to a friend
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

      {/* Lend Item button */}
      <Pressable
        style={styles.lendButton}
        onPress={() => setShowItemModal(true)}
      >
        <Text style={styles.lendButtonText}>+ Lend Item</Text>
      </Pressable>

      {/* Item selection modal */}
      <ItemSelectionModal
        visible={showItemModal}
        onClose={() => setShowItemModal(false)}
        onItemSelected={handleItemSelected}
      />

      {/* Lending form modal */}
      <LendingFormModal
        visible={showFormModal}
        item={selectedItem}
        borrowerName={borrowerName}
        onBorrowerNameChange={setBorrowerName}
        note={note}
        onNoteChange={setNote}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
        loading={formLoading}
      />
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
  lendButton: {
    backgroundColor: '#0a7ea4',
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  lendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

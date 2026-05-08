/**
 * Item Selection Modal
 *
 * Modal dialog for selecting an item to lend.
 * Displays all items from the current space/spaces.
 * User selects one to proceed with lending.
 *
 * Feature: 009 - Lending Tracker
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ItemRepository } from '../../../../repositories/ItemRepository';

interface ItemSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onItemSelected: (item: any) => void;
}

/**
 * ItemSelectionModal Component
 *
 * Shows list of all items available for lending.
 * User taps an item to select it and proceed to form.
 *
 * State:
 * - items: Array of available items
 * - loading: Loading state
 * - error: Error message if load fails
 */
export default function ItemSelectionModal({
  visible,
  onClose,
  onItemSelected,
}: ItemSelectionModalProps) {
  const itemRepository = useMemo(() => new ItemRepository(), []);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load Items
   *
   * Fetch all available items from repository.
   */
  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await itemRepository.getAll();
      setItems(result || []);
    } catch (err: any) {
      setError('Failed to load items');
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load items when modal opens
  useFocusEffect(
    useCallback(() => {
      if (visible) {
        loadItems();
      }
    }, [visible, loadItems])
  );

  /**
   * Render Item
   *
   * List item showing item name and context.
   */
  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      style={styles.itemRow}
      onPress={() => onItemSelected(item)}
    >
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.itemContext} numberOfLines={1}>
          {item.space_name ? `in ${item.space_name}` : 'No space'}
        </Text>
      </View>
      <Text style={styles.itemArrow}>›</Text>
    </Pressable>
  );

  /**
   * Render Empty State
   */
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No items available</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Item to Lend</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0a7ea4" />
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={loadItems}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={renderEmpty}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '80%',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    color: '#999',
  },
  loadingContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#0a7ea4',
    borderRadius: 6,
  },
  retryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  itemRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  itemContext: {
    fontSize: 12,
    color: '#999',
  },
  itemArrow: {
    fontSize: 20,
    color: '#ccc',
    marginLeft: 12,
  },
  emptyContainer: {
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});

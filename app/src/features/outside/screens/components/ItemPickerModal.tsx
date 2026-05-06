/**
 * ItemPickerModal
 * 
 * Multi-select modal to choose items to add to a session
 * 
 * Implementation: T011
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { ItemRepository } from '../../../repositories/ItemRepository';
import { useOutsideService } from '../services/OutsideService';

interface ItemPickerModalProps {
  sessionId: string;
  onItemsSelected: (itemIds: string[]) => void;
  onClose: () => void;
}

interface PickerItem {
  id: string;
  name: string;
  space?: { name: string };
  container?: { name: string };
  selected: boolean;
}

export default function ItemPickerModal({ sessionId, onItemsSelected, onClose }: ItemPickerModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [allItems, setAllItems] = useState<PickerItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PickerItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const itemRepository = new ItemRepository();
      const items = await itemRepository.getAll();
      const pickerItems: PickerItem[] = items.map(item => ({
        id: item.id,
        name: item.name,
        space: item.space,
        container: item.container,
        selected: false,
      }));
      setAllItems(pickerItems);
      setFilteredItems(pickerItems);
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  // Filter items by search text
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredItems(allItems);
    } else {
      const lowerSearch = searchText.toLowerCase();
      setFilteredItems(
        allItems.filter(
          item =>
            item.name.toLowerCase().includes(lowerSearch) ||
            item.space?.name.toLowerCase().includes(lowerSearch) ||
            item.container?.name.toLowerCase().includes(lowerSearch)
        )
      );
    }
  }, [searchText, allItems]);

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItemIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItemIds(newSelected);
  };

  const handleAddItems = () => {
    if (selectedItemIds.size === 0) {
      Alert.alert('No items selected', 'Please select at least one item');
      return;
    }
    onItemsSelected(Array.from(selectedItemIds));
  };

  const renderItem = ({ item }: { item: PickerItem }) => (
    <TouchableOpacity
      style={[
        styles.itemRow,
        { backgroundColor: selectedItemIds.has(item.id) ? colors.tint + '20' : 'transparent' },
      ]}
      onPress={() => handleToggleItem(item.id)}
    >
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: selectedItemIds.has(item.id) ? colors.tint : 'transparent',
            borderColor: colors.tint,
          },
        ]}
      >
        {selectedItemIds.has(item.id) && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.itemLocation, { color: colors.icon }]}>
          {item.space?.name || 'Unknown'} {item.container?.name ? `/ ${item.container.name}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={true} transparent animationType="slide">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Text style={[styles.closeButton, { color: colors.tint, opacity: loading ? 0.5 : 1 }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Select Items</Text>
          <TouchableOpacity onPress={handleAddItems} disabled={loading || selectedItemIds.size === 0}>
            <Text
              style={[
                styles.addButton,
                {
                  color: colors.tint,
                  opacity: loading || selectedItemIds.size === 0 ? 0.5 : 1,
                },
              ]}
            >
              Add ({selectedItemIds.size})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              {
                color: colors.text,
                backgroundColor: colors.background === '#fff' ? '#f5f5f5' : '#2a2a2a',
                borderColor: colors.tint,
              },
            ]}
            placeholder="Search items..."
            placeholderTextColor={colors.icon}
            value={searchText}
            onChangeText={setSearchText}
            editable={!loading}
          />
        </View>

        {/* Items List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={[styles.errorText, { color: '#d32f2f' }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.tint }]}
              onPress={loadItems}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={[styles.emptyText, { color: colors.icon }]}>No items found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            scrollEnabled={true}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  addButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
  },
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  itemLocation: {
    fontSize: 12,
  },
});

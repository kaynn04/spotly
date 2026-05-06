/**
 * SessionDetailScreen
 * 
 * Manage an active outside session
 * Add items, check off items, complete session
 * 
 * Implementation: T008
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useOutsideService } from '../services/OutsideService';
import { OutsideSessionItemWithContext } from '../models/OutsideSessionItem';
import ItemPickerModal from './components/ItemPickerModal';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const outsideService = useOutsideService();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<any>(null);
  const [items, setItems] = useState<OutsideSessionItemWithContext[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showItemPicker, setShowItemPicker] = useState(false);

  // Load session and items
  useFocusEffect(
    useCallback(() => {
      if (id) loadSession();
    }, [id])
  );

  const loadSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionData = await outsideService.getSession(id!);
      console.log('[SessionDetailScreen] Session loaded:', sessionData);
      setSession(sessionData);
      const itemsData = await outsideService.getSessionItems(id!);
      console.log('[SessionDetailScreen] Items loaded:', itemsData);
      console.log('[SessionDetailScreen] First item structure:', itemsData[0]);
      setItems(itemsData);
    } catch (err) {
      console.error('[SessionDetailScreen] Error loading session:', err);
      setError('Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (itemId: string) => {
    try {
      await outsideService.checkItem(id!, itemId);
      await loadSession();
    } catch (err) {
      console.error('Error toggling item:', err);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const handleRemoveItem = (itemId: string) => {
    Alert.alert('Remove Item', 'Remove this item from the session?', [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Remove',
        onPress: async () => {
          try {
            await outsideService.removeItemFromSession(id!, itemId);
            await loadSession();
          } catch (err) {
            console.error('Error removing item:', err);
            Alert.alert('Error', 'Failed to remove item');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleAddItems = () => {
    setShowItemPicker(true);
  };

  const handleItemsSelected = async (itemIds: string[]) => {
    setShowItemPicker(false);
    try {
      await outsideService.addItemsToSession(id!, itemIds);
      await loadSession();
    } catch (err) {
      console.error('Error adding items:', err);
      Alert.alert('Error', 'Failed to add items');
    }
  };

  const handleCompleteSession = () => {
    Alert.alert('Complete Session', 'Mark this session as completed?', [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          try {
            await outsideService.completeSession(id!);
            router.replace('/outside/history');
          } catch (err) {
            console.error('Error completing session:', err);
            Alert.alert('Error', 'Failed to complete session');
          }
        },
        style: 'default',
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: '#d32f2f' }]}>{error || 'Session not found'}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
            onPress={() => {
              router.back();
            }}
          >
            <Text style={[styles.retryButtonText, { color: '#fff' }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderItemComponent = ({ item, index }: { item: OutsideSessionItemWithContext; index: number }) => {
    try {
      // Log item structure for debugging
      console.log('[renderItemComponent] Item data:', {
        id: item.id,
        item_name: item.item_name,
        space_name: item.space_name,
        container_name: item.container_name,
        is_checked: item.is_checked,
      });

      // Validate required fields
      if (!item.item_name) {
        console.warn('[renderItemComponent] Missing item_name:', item);
        return (
          <View style={styles.itemRow}>
            <Text style={{ color: '#d32f2f' }}>Error: Missing item name</Text>
          </View>
        );
      }

      // Safe boolean conversion from SQLite 0/1
      const isChecked = Boolean(item.is_checked);

      // Safe string conversion
      const spaceName = String(item.space_name || 'Unknown');
      const containerName = item.container_name ? String(item.container_name) : null;
      const locationText = containerName ? `${spaceName} / ${containerName}` : spaceName;

      return (
        <View style={[styles.itemRow, { borderBottomColor: '#e0e0e0', borderBottomWidth: index < items.length - 1 ? 1 : 0 }]}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => handleToggleItem(item.item_id)}
          >
            <View
              style={[
                styles.checkbox,
                { backgroundColor: isChecked ? colors.tint : 'transparent', borderColor: colors.tint },
              ]}
            >
              {isChecked && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
          <View style={styles.itemInfo}>
            <Text
              style={[
                styles.itemName,
                { color: colors.text, textDecorationLine: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.5 : 1 },
              ]}
            >
              {String(item.item_name)}
            </Text>
            <Text style={[styles.itemLocation, { color: colors.icon }]}>
              {locationText}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveItem(item.item_id)}
          >
            <Text style={{ color: '#d32f2f' }}>✕</Text>
          </TouchableOpacity>
        </View>
      );
    } catch (err) {
      console.error('[renderItemComponent] Error rendering item:', { item, error: err });
      return (
        <View style={styles.itemRow}>
          <Text style={{ color: '#d32f2f' }}>Error rendering item</Text>
        </View>
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backButton, { color: colors.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{session?.title || 'Session'}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Stats */}
      <View style={[styles.statsContainer, { backgroundColor: colors.tint }]}>
        <Text style={styles.statsText}>
          {session?.checkedCount ?? 0} of {session?.itemCount ?? 0} items checked
        </Text>
      </View>

      {/* Items List - Flex Container */}
      <View style={styles.itemsList}>
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.icon }]}>No items in this session</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderItemComponent}
            keyExtractor={(item) => item.id}
            scrollEnabled={true}
          />
        )}
      </View>

      {/* Actions */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.tint }]}
          onPress={handleAddItems}
        >
          <Text style={styles.addButtonText}>+ Add Items</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.completeButton, { backgroundColor: colors.tint }]}
          onPress={handleCompleteSession}
        >
          <Text style={styles.completeButtonText}>Complete</Text>
        </TouchableOpacity>
      </View>

      {/* Item Picker Modal */}
      {showItemPicker && (
        <ItemPickerModal
          sessionId={id!}
          onItemsSelected={handleItemsSelected}
          onClose={() => setShowItemPicker(false)}
        />
      )}
    </View>
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
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 8,
  },
  statsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  itemsList: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
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
  removeButton: {
    padding: 8,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  completeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

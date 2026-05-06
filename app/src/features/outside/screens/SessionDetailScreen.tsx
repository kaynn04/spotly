/**
 * SessionDetailScreen
 *
 * Manage an active outside session — modern minimalist redesign
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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

const PRIMARY = '#0a84ff';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const outsideService = useOutsideService();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const [session, setSession] = useState<any>(null);
  const [items, setItems] = useState<OutsideSessionItemWithContext[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showItemPicker, setShowItemPicker] = useState(false);

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
      setSession(sessionData);
      const itemsData = await outsideService.getSessionItems(id!);
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
      { text: 'Cancel', style: 'cancel' },
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
    Alert.alert(
      'Complete Session',
      'All done? This will mark the session as completed.',
      [
        { text: 'Cancel', style: 'cancel' },
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
        },
      ]
    );
  };

  const borderColor = isDark ? '#2c2c2e' : '#e8e8ed';
  const subtleText = isDark ? '#8e8e93' : '#6b7280';
  const cardBg = isDark ? '#1c1c1e' : '#ffffff';

  const checkedCount = session?.checkedCount ?? 0;
  const itemCount = session?.itemCount ?? 0;
  const progressPercent = itemCount > 0 ? Math.round((checkedCount / itemCount) * 100) : 0;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#f2f2f7', paddingTop: insets.top }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#f2f2f7', paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: '#ef4444' }]}>{error || 'Session not found'}</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: PRIMARY }]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderItem = ({ item, index }: { item: OutsideSessionItemWithContext; index: number }) => {
    const checked = Boolean(item.is_checked);
    const spaceName = item.space_name && item.space_name !== 'Unknown Space' ? item.space_name : null;
    const containerName = item.container_name ?? null;
    const location = containerName ? `${spaceName ?? ''} › ${containerName}` : spaceName;

    return (
      <TouchableOpacity
        style={[
          styles.itemRow,
          index < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
          checked && { opacity: 0.7 },
        ]}
        onPress={() => handleToggleItem(item.item_id)}
        activeOpacity={0.6}
      >
        {/* Checkbox */}
        <View
          style={[
            styles.checkCircle,
            checked
              ? { backgroundColor: PRIMARY, borderColor: PRIMARY }
              : { borderColor: isDark ? '#48484a' : '#c7c7cc' },
          ]}
        >
          {checked && <Text style={styles.checkMark}>✓</Text>}
        </View>

        {/* Text */}
        <View style={styles.itemTextGroup}>
          <Text
            style={[
              styles.itemName,
              {
                color: colors.text,
                textDecorationLine: checked ? 'line-through' : 'none',
              },
            ]}
            numberOfLines={1}
          >
            {item.item_name}
          </Text>
          {location && (
            <Text style={[styles.itemLocation, { color: subtleText }]} numberOfLines={1}>
              {location}
            </Text>
          )}
        </View>

        {/* Remove */}
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => handleRemoveItem(item.item_id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.removeIcon, { color: isDark ? '#48484a' : '#c7c7cc' }]}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f2f2f7' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: isDark ? '#1c1c1e' : '#ffffff', borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.backText, { color: PRIMARY }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {session.title}
        </Text>
        <View style={{ width: 52 }} />
      </View>

      {/* Progress bar */}
      <View style={[styles.progressHeader, { backgroundColor: isDark ? '#1c1c1e' : '#ffffff', borderBottomColor: borderColor }]}>
        <View style={styles.progressLabelRow}>
          <Text style={[styles.progressLabel, { color: subtleText }]}>
            {checkedCount} of {itemCount} checked
          </Text>
          <Text style={[styles.progressPercent, { color: progressPercent === 100 ? '#34c759' : PRIMARY }]}>
            {progressPercent}%
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: isDark ? '#2c2c2e' : '#e8e8ed' }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? '#34c759' : PRIMARY,
              },
            ]}
          />
        </View>
      </View>

      {/* Items list */}
      <View style={styles.listWrapper}>
        {items.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: subtleText }]}>No items yet</Text>
            <Text style={[styles.emptyHint, { color: subtleText }]}>Tap "+ Add Items" to get started</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { backgroundColor: cardBg }]}
            scrollEnabled
          />
        )}
      </View>

      {/* Bottom action bar */}
      <View
        style={[
          styles.actionBar,
          {
            paddingBottom: insets.bottom + 8,
            backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
            borderTopColor: borderColor,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.outlineButton, { borderColor: PRIMARY }]}
          onPress={() => setShowItemPicker(true)}
        >
          <Text style={[styles.outlineButtonText, { color: PRIMARY }]}>+ Add Items</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { flex: 1, backgroundColor: PRIMARY }]}
          onPress={handleCompleteSession}
        >
          <Text style={styles.primaryButtonText}>Complete</Text>
        </TouchableOpacity>
      </View>

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
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backText: { fontSize: 17, fontWeight: '600', width: 52 },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },

  progressHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 13 },
  progressPercent: { fontSize: 13, fontWeight: '600' },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  listWrapper: { flex: 1 },
  listContent: { borderRadius: 0 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '800' },
  itemTextGroup: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '500' },
  itemLocation: { fontSize: 12, marginTop: 2 },
  removeBtn: { padding: 4 },
  removeIcon: { fontSize: 14 },

  emptyText: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  emptyHint: { fontSize: 14 },
  errorText: { fontSize: 15, marginBottom: 16, textAlign: 'center' },

  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  outlineButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: { fontSize: 15, fontWeight: '600' },
});

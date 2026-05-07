/**
 * SessionDetailScreen
 *
 * Manage an active outside session — modern minimalist redesign
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCheck, faTimes, faHome, faBox, faFolder, faChevronLeft, faMapPin } from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useOutsideService } from '../services/OutsideService';
import { OutsideSessionItemWithContext } from '../models/OutsideSessionItem';
import { SpaceService } from '@/src/services/SpaceService';
import { ContainerService } from '@/src/services/ContainerService';
import { ItemService } from '@/src/services/ItemService';
import type { Space } from '@/src/models/Space';
import type { Container } from '@/src/models/Container';
import ItemPickerModal from './components/ItemPickerModal';

const PRIMARY = '#6b7f99';

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

  // Put Away state
  const [putAwayItem, setPutAwayItem] = useState<OutsideSessionItemWithContext | null>(null);
  const [showPutAwaySheet, setShowPutAwaySheet] = useState(false);
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [spaceContainers, setSpaceContainers] = useState<Record<string, Container[]>>({});
  const [currentItemSpaceId, setCurrentItemSpaceId] = useState<string | null>(null);
  const [currentItemContainerId, setCurrentItemContainerId] = useState<string | null>(null);

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

  const handleToggleItem = async (item: OutsideSessionItemWithContext) => {
    const checked = Boolean(item.is_checked);
    if (checked) {
      // Item is already checked (dealt with) — uncheck to undo
      try {
        await outsideService.checkItem(id!, item.item_id);
        await loadSession();
      } catch (err) {
        console.error('Error toggling item:', err);
        Alert.alert('Error', 'Failed to update item');
      }
    } else {
      // Item is unchecked — show "Put Away" sheet to decide where it goes
      setPutAwayItem(item);
      setShowPutAwaySheet(true);
    }
  };

  const handlePutAwayOriginal = async () => {
    // Return to original location — just check the item
    setShowPutAwaySheet(false);
    if (!putAwayItem) return;
    try {
      await outsideService.checkItem(id!, putAwayItem.item_id);
      await loadSession();
    } catch (err) {
      Alert.alert('Error', 'Failed to update item');
    }
    setPutAwayItem(null);
  };

  const handlePutAwayMove = async () => {
    setShowPutAwaySheet(false);
    // Load all spaces, containers, and the item's current location IDs
    try {
      const [spaces, currentItem] = await Promise.all([
        SpaceService.getAllSpaces(),
        ItemService.getItemById(putAwayItem!.item_id),
      ]);
      setAllSpaces(spaces);
      setCurrentItemSpaceId(currentItem?.spaceId ?? null);
      setCurrentItemContainerId(currentItem?.containerId ?? null);
      const containersMap: Record<string, Container[]> = {};
      await Promise.all(
        spaces.map(async (s) => {
          const cs = await ContainerService.getContainersBySpaceId(s.id);
          containersMap[s.id] = cs;
        })
      );
      setSpaceContainers(containersMap);
      setShowMoveSheet(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to load spaces');
      setPutAwayItem(null);
    }
  };

  const handleMoveToSpace = async (spaceId: string) => {
    if (!putAwayItem) return;
    setShowMoveSheet(false);
    try {
      await ItemService.moveItem(putAwayItem.item_id, '', spaceId);
      const spaceName = allSpaces.find(s => s.id === spaceId)?.name ?? 'Unknown';
      await outsideService.recordItemMove(id!, putAwayItem.item_id, spaceName, null);
      await outsideService.checkItem(id!, putAwayItem.item_id); // check as dealt with
      await loadSession();
    } catch (err) {
      Alert.alert('Error', 'Failed to move item');
    }
    setPutAwayItem(null);
  };

  const handleMoveToContainer = async (spaceId: string, containerId: string) => {
    if (!putAwayItem) return;
    setShowMoveSheet(false);
    try {
      await ItemService.moveItemToContainer(putAwayItem.item_id, spaceId, containerId);
      const spaceName = allSpaces.find(s => s.id === spaceId)?.name ?? 'Unknown';
      const containerName = spaceContainers[spaceId]?.find(c => c.id === containerId)?.name ?? null;
      await outsideService.recordItemMove(id!, putAwayItem.item_id, spaceName, containerName);
      await outsideService.checkItem(id!, putAwayItem.item_id); // check as dealt with
      await loadSession();
    } catch (err) {
      Alert.alert('Error', 'Failed to move item');
    }
    setPutAwayItem(null);
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

  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const cardBg = isDark ? '#1c1c1e' : '#ffffff';

  const checkedCount = session?.checkedCount ?? 0;
  const itemCount = session?.itemCount ?? 0;
  const progressPercent = itemCount > 0 ? Math.round((checkedCount / itemCount) * 100) : 0;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#f8f9fa', paddingTop: insets.top }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#f8f9fa', paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: '#d32f2f' }]}>{error || 'Session not found'}</Text>
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
        onPress={() => handleToggleItem(item)}
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
          {checked && <FontAwesomeIcon icon={faCheck} size={12} color="#ffffff" />}
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
          <FontAwesomeIcon icon={faTimes} size={14} color={isDark ? '#48484a' : '#c7c7cc'} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: isDark ? '#1c1c1e' : '#ffffff', borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <FontAwesomeIcon icon={faChevronLeft} size={16} color={PRIMARY} />
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
          <Text style={[styles.progressPercent, { color: progressPercent === 100 ? '#6b9e7a' : PRIMARY }]}>
            {progressPercent}%
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: isDark ? '#2c2c2e' : '#e8e8ed' }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? '#6b9e7a' : PRIMARY,
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

      {/* Put Away Bottom Sheet */}
      <Modal visible={showPutAwaySheet} transparent animationType="slide" onRequestClose={() => { setShowPutAwaySheet(false); setPutAwayItem(null); }}>
        <TouchableWithoutFeedback onPress={() => { setShowPutAwaySheet(false); setPutAwayItem(null); }}>
          <View style={styles.sheetBackdrop} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Put Away</Text>
          <Text style={[styles.sheetSubtitle, { color: subtleText }]}>
            Where do you want to put "{putAwayItem?.item_name}"?
          </Text>
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: isDark ? '#2c2c2e' : '#f8f9fa', borderColor }]}
              onPress={handlePutAwayOriginal}
              activeOpacity={0.7}
            >
              <FontAwesomeIcon icon={faHome} size={18} color={PRIMARY} />
              <View style={styles.sheetOptionText}>
                <Text style={[styles.sheetOptionLabel, { color: colors.text }]}>Return to original location</Text>
                <Text style={[styles.sheetOptionDesc, { color: subtleText }]}>
                  {putAwayItem?.container_name
                    ? `${putAwayItem.space_name} › ${putAwayItem.container_name}`
                    : putAwayItem?.space_name ?? 'Current location'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: isDark ? '#2c2c2e' : '#f8f9fa', borderColor }]}
              onPress={handlePutAwayMove}
              activeOpacity={0.7}
            >
              <FontAwesomeIcon icon={faBox} size={18} color={PRIMARY} />
              <View style={styles.sheetOptionText}>
                <Text style={[styles.sheetOptionLabel, { color: colors.text }]}>Move to a different location</Text>
                <Text style={[styles.sheetOptionDesc, { color: subtleText }]}>Choose a space or container</Text>
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.sheetCancel, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}
            onPress={() => { setShowPutAwaySheet(false); setPutAwayItem(null); }}
          >
            <Text style={[styles.sheetCancelText, { color: PRIMARY }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Move Picker Modal */}
      <Modal visible={showMoveSheet} transparent animationType="slide" onRequestClose={() => { setShowMoveSheet(false); setPutAwayItem(null); }}>
        <TouchableWithoutFeedback onPress={() => { setShowMoveSheet(false); setPutAwayItem(null); }}>
          <View style={styles.sheetBackdrop} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, styles.moveSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Move to a Different Location</Text>
          <FlatList
            data={allSpaces}
            keyExtractor={(s) => s.id}
            style={styles.moveList}
            ListHeaderComponent={
              putAwayItem ? (
                <View style={styles.moveCurrentSection}>
                  <Text style={[styles.moveSectionLabel, { color: subtleText }]}>CURRENT LOCATION</Text>
                  <View style={[styles.moveOption, styles.moveOptionDisabled, { borderColor }]}>
                    <FontAwesomeIcon
                      icon={putAwayItem.container_name ? faFolder : faMapPin}
                      size={16}
                      color={subtleText}
                    />
                    <Text style={[styles.moveOptionText, { color: subtleText }]} numberOfLines={1}>
                      {putAwayItem.container_name
                        ? `${putAwayItem.container_name} · ${putAwayItem.space_name}`
                        : putAwayItem.space_name ?? 'Unknown'}
                    </Text>
                    <View style={[styles.currentBadge, { backgroundColor: `${PRIMARY}18` }]}>
                      <Text style={[styles.currentBadgeText, { color: PRIMARY }]}>Here</Text>
                    </View>
                  </View>
                  <Text style={[styles.moveSectionLabel, { color: subtleText, marginTop: 12 }]}>MOVE TO</Text>
                </View>
              ) : null
            }
            renderItem={({ item: space }) => {
              const isCurrentSpace = space.id === currentItemSpaceId;
              const containers = (spaceContainers[space.id] ?? []).filter(
                (c) => c.id !== currentItemContainerId
              );
              // In current space: only show root if item is inside a container
              // In other spaces: always show root
              const showRoot = isCurrentSpace ? !!currentItemContainerId : true;
              if (!showRoot && containers.length === 0) return null;
              return (
                <View>
                  {!isCurrentSpace && (
                    <Text style={[styles.moveSectionLabel, { color: subtleText }]}>{space.name.toUpperCase()}</Text>
                  )}
                  {showRoot && (
                    <TouchableOpacity
                      style={[styles.moveOption, { borderColor }]}
                      onPress={() => handleMoveToSpace(space.id)}
                      activeOpacity={0.7}
                    >
                      <FontAwesomeIcon icon={faMapPin} size={16} color={PRIMARY} />
                      <Text style={[styles.moveOptionText, { color: colors.text }]}>
                        {isCurrentSpace ? `Root of ${space.name}` : `${space.name} (root)`}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {containers.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.moveOption, isCurrentSpace && styles.moveOptionNested, { borderColor }]}
                      onPress={() => handleMoveToContainer(space.id, c.id)}
                      activeOpacity={0.7}
                    >
                      <FontAwesomeIcon icon={faFolder} size={16} color={PRIMARY} />
                      <Text style={[styles.moveOptionText, { color: colors.text }]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            }}
          />
          <TouchableOpacity
            style={[styles.sheetCancel, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}
            onPress={() => { setShowMoveSheet(false); setPutAwayItem(null); }}
          >
            <Text style={[styles.sheetCancelText, { color: PRIMARY }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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

  // Put Away / Move sheets
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 },
  sheetSubtitle: { fontSize: 14, marginBottom: 20 },
  sheetActions: { gap: 10, marginBottom: 16 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  sheetOptionIcon: { fontSize: 20 },
  sheetOptionText: { flex: 1 },
  sheetOptionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  sheetOptionDesc: { fontSize: 12 },
  sheetCancel: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetCancelText: { fontSize: 16, fontWeight: '600' },

  // Move sheet
  moveSheet: { maxHeight: '70%' },
  moveList: { marginBottom: 12 },
  moveCurrentSection: { marginBottom: 4 },
  moveSectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 },
  moveOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
    gap: 12,
  },
  moveOptionDisabled: { opacity: 0.6 },
  moveOptionNested: { marginLeft: 24 },
  moveOptionIcon: { fontSize: 16 },
  moveOptionText: { flex: 1, fontSize: 15, fontWeight: '500' },
  moveOptionHint: { fontSize: 11 },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  currentBadgeText: { fontSize: 11, fontWeight: '600' },
});

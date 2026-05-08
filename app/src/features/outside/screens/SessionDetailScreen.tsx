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
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCheck, faTimes, faHome, faBox, faFolder, faChevronLeft, faMapPin, faHandshake, faTrash } from '@fortawesome/free-solid-svg-icons';
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
import { LendingService } from '@/src/features/lending/services/LendingService';
import { LendingRepository } from '@/src/features/lending/repositories/LendingRepository';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import LendingFormModal from '@/src/features/lending/screens/components/LendingFormModal';
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

  // Check Off state
  const [putAwayItem, setPutAwayItem] = useState<OutsideSessionItemWithContext | null>(null);
  const [showPutAwaySheet, setShowPutAwaySheet] = useState(false);

  // Lending state
  const [showLendModal, setShowLendModal] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const [lendNote, setLendNote] = useState('');
  const [lendLoading, setLendLoading] = useState(false);

  const lendingService = useMemo(
    () => new LendingService(new LendingRepository(), new ItemRepository()),
    []
  );
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [showUncheckSheet, setShowUncheckSheet] = useState(false);
  const [uncheckItem, setUncheckItem] = useState<OutsideSessionItemWithContext | null>(null);
  const [uncheckItemHasLending, setUncheckItemHasLending] = useState(false);
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
    // Completed sessions are read-only
    if (session?.status !== 'ACTIVE') return;
    const checked = Boolean(item.is_checked);
    if (checked) {
      // Show confirmation before unchecking — check if item has active lending
      setUncheckItem(item);
      setUncheckItemHasLending(false);
      lendingService.getActiveLendingForItem(item.item_id).then((lending) => {
        setUncheckItemHasLending(!!lending);
      }).catch(() => {});
      setShowUncheckSheet(true);
    } else {
      // Item is unchecked — show check-off sheet to decide what to do
      setPutAwayItem(item);
      setShowPutAwaySheet(true);
    }
  };

  const handleConfirmUncheck = async () => {
    if (!uncheckItem) return;
    setShowUncheckSheet(false);
    try {
      // If this item has an active lending, cancel it (mark as returned)
      const activeLending = await lendingService.getActiveLendingForItem(uncheckItem.item_id);
      if (activeLending) {
        await lendingService.markAsReturned(activeLending.id);
      }
      await outsideService.checkItem(id!, uncheckItem.item_id);
      await loadSession();
    } catch {
      Alert.alert('Error', 'Failed to uncheck item');
    }
    setUncheckItem(null);
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
      setAllSpaces([...spaces].sort((a, b) => {
        if (a.id === currentItem?.spaceId) return -1;
        if (b.id === currentItem?.spaceId) return 1;
        return 0;
      }));
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
      if (spaceId === currentItemSpaceId) {
        // Moving to root of the same space — just clear the container
        await ItemService.moveItemToContainer(putAwayItem.item_id, spaceId, '');
      } else {
        await ItemService.moveItem(putAwayItem.item_id, currentItemSpaceId ?? '', spaceId);
      }
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

  const handleLendSubmit = async () => {
    if (!borrowerName.trim() || !putAwayItem) return;
    setLendLoading(true);
    try {
      await lendingService.createLending({
        item_id: putAwayItem.item_id,
        borrower_name: borrowerName.trim(),
        note: lendNote.trim() || undefined,
      });
      setShowLendModal(false);
      setBorrowerName('');
      setLendNote('');
      // Check the item off since it's been dealt with
      await outsideService.checkItem(id!, putAwayItem.item_id);
      setPutAwayItem(null);
      await loadSession();
    } catch (err: any) {
      Alert.alert('Error', err.code === 'DUPLICATE_ACTIVE_LENDING'
        ? 'This item is already lent out'
        : err.message || 'Failed to lend item');
    } finally {
      setLendLoading(false);
    }
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

  const handleDeleteSession = () => {
    Alert.alert(
      'Delete Session',
      'This will permanently delete this session and remove all its items from the list. The items themselves will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await outsideService.deleteSession(id!);
              router.replace('/(tabs)/outside');
            } catch (err) {
              console.error('Error deleting session:', err);
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
  };

  const handleCompleteSession = () => {
    const uncheckedCount = items.filter(item => !item.is_checked).length;

    const doComplete = async () => {
      try {
        await outsideService.completeSession(id!);
        router.replace('/outside/history');
      } catch (err) {
        console.error('Error completing session:', err);
        Alert.alert('Error', 'Failed to complete session');
      }
    };

    if (uncheckedCount > 0) {
      Alert.alert(
        'Unchecked Items',
        `${uncheckedCount} item${uncheckedCount === 1 ? '' : 's'} ${uncheckedCount === 1 ? 'has' : 'have'} not been checked off and will remain in ${uncheckedCount === 1 ? 'its' : 'their'} original location. Complete anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete Anyway', onPress: doComplete },
        ]
      );
    } else if (items.length === 0) {
      Alert.alert(
        'No Items',
        'This session has no items. Mark it as completed?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete', onPress: doComplete },
        ]
      );
    } else {
      Alert.alert(
        'Complete Session',
        'All items checked! Mark this session as completed?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete', onPress: doComplete },
        ]
      );
    }
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
    const wasMoved = checked && !!item.moved_to_space_name;
    const spaceName = item.space_name && item.space_name !== 'Unknown Space' ? item.space_name : null;
    const containerName = item.container_name ?? null;
    const originalLocation = containerName ? `${spaceName ?? ''} › ${containerName}` : spaceName;
    const movedLocation = item.moved_to_container_name
      ? `${item.moved_to_space_name} › ${item.moved_to_container_name}`
      : item.moved_to_space_name;
    const locationLine = wasMoved ? `→ ${movedLocation}` : originalLocation;
    const checkColor = wasMoved ? (isDark ? '#4ade80' : '#6b9e7a') : PRIMARY;

    return (
      <TouchableOpacity
        style={[
          styles.itemRow,
          index < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
          checked && { opacity: 0.65 },
        ]}
        onPress={() => handleToggleItem(item)}
        activeOpacity={0.6}
      >
        {/* Checkbox */}
        <View
          style={[
            styles.checkCircle,
            checked
              ? { backgroundColor: checkColor, borderColor: checkColor }
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
              { color: colors.text, textDecorationLine: checked ? 'line-through' : 'none' },
            ]}
            numberOfLines={1}
          >
            {item.item_name}
          </Text>
          {locationLine && (
            <Text
              style={[styles.itemLocation, { color: wasMoved ? (isDark ? '#4ade80' : '#6b9e7a') : subtleText }]}
              numberOfLines={1}
            >
              {locationLine}
            </Text>
          )}
        </View>

        {/* Remove — only for active sessions */}
        {session?.status === 'ACTIVE' && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemoveItem(item.item_id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FontAwesomeIcon icon={faTimes} size={14} color={isDark ? '#48484a' : '#c7c7cc'} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <FontAwesomeIcon icon={faChevronLeft} size={16} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {session.title}
        </Text>
        <TouchableOpacity onPress={handleDeleteSession} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 52, alignItems: 'flex-end' }}>
          <FontAwesomeIcon icon={faTrash} size={16} color="#d32f2f" />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressHeader, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <View style={styles.progressLabelRow}>
          <Text style={[styles.progressLabel, { color: subtleText }]}>
            {checkedCount} of {itemCount} checked
          </Text>
          <Text style={[styles.progressPercent, { color: progressPercent === 100 ? (isDark ? '#4ade80' : '#6b9e7a') : PRIMARY }]}>
            {progressPercent}%
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: isDark ? '#2c2c2e' : '#e8e8ed' }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? (isDark ? '#4ade80' : '#6b9e7a') : PRIMARY,
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

      {/* Bottom action bar — only for active sessions */}
      {session.status === 'ACTIVE' && (
        <View
          style={[
            styles.actionBar,
            {
              paddingBottom: insets.bottom + 8,
              backgroundColor: cardBg,
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
      )}

      {showItemPicker && (
        <ItemPickerModal
          sessionId={id!}
          onItemsSelected={handleItemsSelected}
          onClose={() => setShowItemPicker(false)}
        />
      )}

      {/* Uncheck Confirmation Sheet */}
      <Modal visible={showUncheckSheet} transparent animationType="slide" onRequestClose={() => { setShowUncheckSheet(false); setUncheckItem(null); }}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.uncheckSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Uncheck item?</Text>
            {uncheckItemHasLending ? (
              <Text style={[styles.sheetSubtitle, { color: subtleText }]}>
                {`"${uncheckItem?.item_name}" is currently lent out. Unchecking will also cancel the lending.`}
              </Text>
            ) : uncheckItem?.moved_to_space_name ? (
              <Text style={[styles.sheetSubtitle, { color: subtleText }]}>
                {`"${uncheckItem.item_name}" was moved to ${uncheckItem.moved_to_container_name ? `${uncheckItem.moved_to_space_name} › ${uncheckItem.moved_to_container_name}` : uncheckItem.moved_to_space_name}. Unchecking won't move it back.`}
              </Text>
            ) : (
              <Text style={[styles.sheetSubtitle, { color: subtleText }]}>
                {`Mark "${uncheckItem?.item_name}" as not yet dealt with?`}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: isDark ? '#2c2c2e' : '#f8f9fa', borderColor }]}
              onPress={handleConfirmUncheck}
              activeOpacity={0.7}
            >
              <View style={styles.sheetOptionText}>
                <Text style={[styles.sheetOptionLabel, { color: colors.text }]}>Uncheck</Text>
                <Text style={[styles.sheetOptionDesc, { color: subtleText }]}>Mark as not yet dealt with</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetCancel, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', marginTop: 10 }]}
              onPress={() => { setShowUncheckSheet(false); setUncheckItem(null); }}
            >
              <Text style={[styles.sheetCancelText, { color: PRIMARY }]}>Keep checked</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Check Off Bottom Sheet */}
      <Modal visible={showPutAwaySheet} transparent animationType="slide" onRequestClose={() => { setShowPutAwaySheet(false); setPutAwayItem(null); }}>
        <TouchableWithoutFeedback onPress={() => { setShowPutAwaySheet(false); setPutAwayItem(null); }}>
          <View style={styles.sheetBackdrop} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Check Off</Text>
          <Text style={[styles.sheetSubtitle, { color: subtleText }]}>
            What do you want to do with "{putAwayItem?.item_name}"?
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
            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: isDark ? '#2c2c2e' : '#f8f9fa', borderColor }]}
              onPress={() => {
                setShowPutAwaySheet(false);
                setBorrowerName('');
                setLendNote('');
                setShowLendModal(true);
              }}
              activeOpacity={0.7}
            >
              <FontAwesomeIcon icon={faHandshake} size={18} color={PRIMARY} />
              <View style={styles.sheetOptionText}>
                <Text style={[styles.sheetOptionLabel, { color: colors.text }]}>Lend to someone</Text>
                <Text style={[styles.sheetOptionDesc, { color: subtleText }]}>Track who you're lending this to</Text>
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
        <View style={styles.sheetOverlay}>
          <View style={[styles.moveSheetContainer, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Move to a Different Location</Text>
          <ScrollView style={styles.moveList} showsVerticalScrollIndicator={false}>
            {allSpaces.map((space) => {
              const isCurrentSpace = space.id === currentItemSpaceId;
              const containers = spaceContainers[space.id] ?? [];
              const isRootCurrent = isCurrentSpace && !currentItemContainerId;
              return (
                <View key={space.id}>
                  <Text style={[styles.moveSectionLabel, { color: subtleText }]}>
                    {isCurrentSpace ? 'IN THIS SPACE' : space.name.toUpperCase()}
                  </Text>
                  <TouchableOpacity
                    style={[styles.moveOption, isRootCurrent && styles.moveOptionDisabled, { borderColor }]}
                    onPress={isRootCurrent ? undefined : () => handleMoveToSpace(space.id)}
                    activeOpacity={isRootCurrent ? 1 : 0.7}
                  >
                    <FontAwesomeIcon icon={faMapPin} size={16} color={isRootCurrent ? subtleText : PRIMARY} />
                    <Text style={[styles.moveOptionText, { color: isRootCurrent ? subtleText : colors.text }]}>
                      {isCurrentSpace ? `Root of ${space.name}` : `${space.name} (root)`}
                    </Text>
                    {isRootCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: `${PRIMARY}18` }]}>
                        <Text style={[styles.currentBadgeText, { color: PRIMARY }]}>Here</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {containers.map((c) => {
                    const isContainerCurrent = c.id === currentItemContainerId;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.moveOption,
                          !isCurrentSpace && styles.moveOptionNested,
                          isContainerCurrent && styles.moveOptionDisabled,
                          { borderColor },
                        ]}
                        onPress={isContainerCurrent ? undefined : () => handleMoveToContainer(space.id, c.id)}
                        activeOpacity={isContainerCurrent ? 1 : 0.7}
                      >
                        <FontAwesomeIcon icon={faFolder} size={16} color={isContainerCurrent ? subtleText : PRIMARY} />
                        <Text style={[styles.moveOptionText, { color: isContainerCurrent ? subtleText : colors.text }]}>
                          {c.name}
                        </Text>
                        {isContainerCurrent && (
                          <View style={[styles.currentBadge, { backgroundColor: `${PRIMARY}18` }]}>
                            <Text style={[styles.currentBadgeText, { color: PRIMARY }]}>Here</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.sheetCancel, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}
            onPress={() => { setShowMoveSheet(false); setPutAwayItem(null); }}
          >
            <Text style={[styles.sheetCancelText, { color: PRIMARY }]}>Cancel</Text>
          </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Lend Modal */}
      <LendingFormModal
        visible={showLendModal}
        item={putAwayItem ? { id: putAwayItem.item_id, name: putAwayItem.item_name } : null}
        borrowerName={borrowerName}
        onBorrowerNameChange={setBorrowerName}
        note={lendNote}
        onNoteChange={setLendNote}
        onSubmit={handleLendSubmit}
        onCancel={() => { setShowLendModal(false); setBorrowerName(''); setLendNote(''); setPutAwayItem(null); }}
        loading={lendLoading}
      />
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
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
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
  uncheckSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  moveSheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '70%',
  },
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

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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCheck, faTimes, faHome, faBox, faFolder, faChevronLeft, faMapPin, faHandshake, faTrash } from '@fortawesome/free-solid-svg-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';

const PRIMARY = '#4f8f7b';
const LENDING = '#9b72cb';
type OutsidePhase = 'leaving' | 'returning';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const outsideService = useOutsideService();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const isDark = colorScheme === 'dark';

  const [session, setSession] = useState<any>(null);
  const [items, setItems] = useState<OutsideSessionItemWithContext[]>([]);
  const [phase, setPhase] = useState<OutsidePhase>('leaving');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showItemPicker, setShowItemPicker] = useState(false);

  // Check Off state
  const [putAwayItem, setPutAwayItem] = useState<OutsideSessionItemWithContext | null>(null);
  const [showPutAwaySheet, setShowPutAwaySheet] = useState(false);
  const [wrapUpItems, setWrapUpItems] = useState<OutsideSessionItemWithContext[]>([]);
  const [wrapUpIndex, setWrapUpIndex] = useState(0);
  const [wrapUpLoading, setWrapUpLoading] = useState(false);
  const isWrapUpMode = wrapUpItems.length > 0;

  // Lending state
  const [showLendModal, setShowLendModal] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const [lendNote, setLendNote] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [lendLoading, setLendLoading] = useState(false);

  const lendingService = useMemo(
    () => new LendingService(new LendingRepository(), new ItemRepository()),
    []
  );
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [showUncheckSheet, setShowUncheckSheet] = useState(false);
  const [uncheckItem, setUncheckItem] = useState<OutsideSessionItemWithContext | null>(null);
  const uncheckItemHasLending = false;
  const [showLostReportModal, setShowLostReportModal] = useState(false);
  const [lostReportComment, setLostReportComment] = useState('');
  const [lostReportItems, setLostReportItems] = useState<OutsideSessionItemWithContext[]>([]);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [spaceContainers, setSpaceContainers] = useState<Record<string, Container[]>>({});
  const [currentItemSpaceId, setCurrentItemSpaceId] = useState<string | null>(null);
  const [currentItemContainerId, setCurrentItemContainerId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (id) loadSession();
      // loadSession intentionally refreshes the current route id on focus.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  );

  const loadSession = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
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
      if (showSpinner) setLoading(false);
    }
  };

  const handleToggleItem = async (item: OutsideSessionItemWithContext) => {
    // Completed sessions are read-only
    if (session?.status !== 'ACTIVE') return;
    const nextChecked = !item.is_checked;
    const nextCheckedAt = nextChecked ? new Date().toISOString() : null;
    setItems((prev) =>
      prev.map((sessionItem) =>
        sessionItem.item_id === item.item_id
          ? { ...sessionItem, is_checked: nextChecked ? 1 : 0, checked_at: nextCheckedAt }
          : sessionItem
      )
    );
    setSession((prev: any) => prev
      ? { ...prev, checkedCount: Math.max(0, (prev.checkedCount ?? 0) + (nextChecked ? 1 : -1)) }
      : prev
    );
    try {
      await outsideService.checkItem(id!, item.item_id);
      await loadSession(false);
    } catch {
      await loadSession(false);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const handleToggleReturnItem = async (item: OutsideSessionItemWithContext) => {
    if (session?.status !== 'ACTIVE') return;
    const nextChecked = !item.return_checked;
    const nextCheckedAt = nextChecked ? new Date().toISOString() : null;
    setItems((prev) =>
      prev.map((sessionItem) =>
        sessionItem.item_id === item.item_id
          ? { ...sessionItem, return_checked: nextChecked ? 1 : 0, return_checked_at: nextCheckedAt }
          : sessionItem
      )
    );
    setSession((prev: any) => prev
      ? { ...prev, returnCheckedCount: Math.max(0, (prev.returnCheckedCount ?? 0) + (nextChecked ? 1 : -1)) }
      : prev
    );
    try {
      await outsideService.checkReturnItem(id!, item.item_id);
      await loadSession(false);
    } catch {
      await loadSession(false);
      Alert.alert('Error', 'Failed to update return check');
    }
  };

  const finishWrapUp = async () => {
    setWrapUpLoading(true);
    try {
      await outsideService.completeSession(id!);
      setWrapUpItems([]);
      setWrapUpIndex(0);
      setPutAwayItem(null);
      setShowPutAwaySheet(false);
      router.replace('/outside/history');
    } catch (err) {
      console.error('Error completing session:', err);
      Alert.alert('Error', 'Failed to complete session');
    } finally {
      setWrapUpLoading(false);
    }
  };

  const advanceWrapUp = async () => {
    const nextIndex = wrapUpIndex + 1;
    if (nextIndex >= wrapUpItems.length) {
      await finishWrapUp();
      return;
    }

    setWrapUpIndex(nextIndex);
    setPutAwayItem(wrapUpItems[nextIndex]);
    setShowPutAwaySheet(true);
  };

  const cancelWrapUp = () => {
    setShowPutAwaySheet(false);
    setPutAwayItem(null);
    setWrapUpItems([]);
    setWrapUpIndex(0);
  };

  const startWrapUp = () => {
    if (items.length === 0) {
      finishWrapUp();
      return;
    }

    setWrapUpItems(items);
    setWrapUpIndex(0);
    setPutAwayItem(items[0]);
    setShowPutAwaySheet(true);
  };

  const completeAllReturned = async () => {
    setWrapUpLoading(true);
    try {
      await outsideService.completeSession(id!);
      router.replace('/outside/history');
    } catch (err) {
      console.error('Error completing session:', err);
      Alert.alert('Error', 'Failed to complete session');
    } finally {
      setWrapUpLoading(false);
    }
  };

  const openLostReportModal = () => {
    const unconfirmedItems = items.filter(item => !item.return_checked);
    setLostReportItems(unconfirmedItems);
    setLostReportComment('');
    setShowLostReportModal(true);
  };

  const submitLostReport = async () => {
    const itemIds = lostReportItems.map(item => item.item_id);
    if (itemIds.length === 0) {
      setShowLostReportModal(false);
      return;
    }

    try {
      setShowLostReportModal(false);
      await outsideService.reportItemIssues(id!, itemIds, 'LOST', lostReportComment.trim() || undefined);
      await outsideService.completeSession(id!);
      router.replace('/outside/history');
    } catch (err) {
      console.error('Error reporting lost items:', err);
      Alert.alert('Error', 'Failed to report lost item');
    }
  };

  const showUnconfirmedOptions = () => {
    const unconfirmedItems = items.filter(item => !item.return_checked);
    const preview = unconfirmedItems.slice(0, 3).map(item => item.item_name).join(', ');
    const more = unconfirmedItems.length > 3 ? ` and ${unconfirmedItems.length - 3} more` : '';

    Alert.alert(
      'Unconfirmed Items',
      `${unconfirmedItems.length} item${unconfirmedItems.length === 1 ? '' : 's'} ${unconfirmedItems.length === 1 ? 'was' : 'were'} not checked: ${preview}${more}`,
      [
        { text: 'Review Checklist', style: 'cancel', onPress: () => setPhase('returning') },
        { text: 'Proceed Anyway', onPress: startWrapUp },
        {
          text: 'Report Lost',
          onPress: openLostReportModal,
        },
      ]
    );
  };

  const dismissPutAwaySheet = () => {
    if (isWrapUpMode) {
      cancelWrapUp();
      return;
    }
    setShowPutAwaySheet(false);
    setPutAwayItem(null);
  };

  const closeMoveSheet = () => {
    setShowMoveSheet(false);
    if (isWrapUpMode) {
      setShowPutAwaySheet(true);
      return;
    }
    setPutAwayItem(null);
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
      if (!isWrapUpMode && !putAwayItem.is_checked) {
        await outsideService.checkItem(id!, putAwayItem.item_id);
      }
      await loadSession();
      if (isWrapUpMode) {
        await advanceWrapUp();
      }
    } catch {
      Alert.alert('Error', 'Failed to update item');
    }
    if (!isWrapUpMode) setPutAwayItem(null);
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
    } catch {
      Alert.alert('Error', 'Failed to load spaces');
      if (!isWrapUpMode) setPutAwayItem(null);
      if (isWrapUpMode) setShowPutAwaySheet(true);
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
      if (!isWrapUpMode && !putAwayItem.is_checked) {
        await outsideService.checkItem(id!, putAwayItem.item_id);
      }
      await loadSession();
      if (isWrapUpMode) {
        await advanceWrapUp();
      }
    } catch {
      Alert.alert('Error', 'Failed to move item');
    }
    if (!isWrapUpMode) setPutAwayItem(null);
  };

  const handleMoveToContainer = async (spaceId: string, containerId: string) => {
    if (!putAwayItem) return;
    setShowMoveSheet(false);
    try {
      await ItemService.moveItemToContainer(putAwayItem.item_id, spaceId, containerId);
      const spaceName = allSpaces.find(s => s.id === spaceId)?.name ?? 'Unknown';
      const containerName = spaceContainers[spaceId]?.find(c => c.id === containerId)?.name ?? null;
      await outsideService.recordItemMove(id!, putAwayItem.item_id, spaceName, containerName);
      if (!isWrapUpMode && !putAwayItem.is_checked) {
        await outsideService.checkItem(id!, putAwayItem.item_id);
      }
      await loadSession();
      if (isWrapUpMode) {
        await advanceWrapUp();
      }
    } catch {
      Alert.alert('Error', 'Failed to move item');
    }
    if (!isWrapUpMode) setPutAwayItem(null);
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
        due_date: dueDate ?? undefined,
      });
      setShowLendModal(false);
      setBorrowerName('');
      setLendNote('');
      setDueDate(null);
      if (!isWrapUpMode && !putAwayItem.is_checked) {
        await outsideService.checkItem(id!, putAwayItem.item_id);
      }
      await loadSession();
      if (isWrapUpMode) {
        await advanceWrapUp();
      } else {
        setPutAwayItem(null);
      }
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
              router.replace('/outside' as any);
            } catch (err) {
              console.error('Error deleting session:', err);
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
  };

  const handleStartGoingHomeCheck = () => {
    if (items.length === 0) {
      Alert.alert('No Items', 'Add items before starting the going home check.');
      return;
    }

    const unpackedItems = items.filter(item => !item.is_checked);
    if (unpackedItems.length === 0) {
      setPhase('returning');
      return;
    }

    const preview = unpackedItems.slice(0, 3).map(item => item.item_name).join(', ');
    const more = unpackedItems.length > 3 ? ` and ${unpackedItems.length - 3} more` : '';
    Alert.alert(
      'Finish Leaving First',
      `${unpackedItems.length} item${unpackedItems.length === 1 ? '' : 's'} still need${unpackedItems.length === 1 ? 's' : ''} to be packed: ${preview}${more}`,
      [{ text: 'Review Checklist' }]
    );
  };

  const handleCompleteSession = () => {
    const unconfirmedCount = items.filter(item => !item.return_checked).length;
    const doComplete = () => startWrapUp();

    if (items.length === 0) {
      Alert.alert(
        'No Items',
        'This checklist has no items. End it now?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'End Session', onPress: doComplete },
        ]
      );
    } else if (phase !== 'returning') {
      Alert.alert(
        'Do a going home check?',
        'Before ending, switch to the going home checklist so you can confirm each item is still with you.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Check', onPress: handleStartGoingHomeCheck },
        ]
      );
    } else if (unconfirmedCount > 0) {
      showUnconfirmedOptions();
    } else {
      Alert.alert(
        'End Session',
        'All items are confirmed. What happened to the items?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'All Returned', onPress: completeAllReturned },
          { text: 'Choose Per Item', onPress: doComplete },
        ]
      );
    }
  };

  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const cardBg = isDark ? '#1c1c1e' : '#ffffff';

  const leavingCheckedCount = session?.checkedCount ?? 0;
  const returningCheckedCount = session?.returnCheckedCount ?? 0;
  const itemCount = session?.itemCount ?? 0;
  const checkedCount = phase === 'leaving' ? leavingCheckedCount : returningCheckedCount;
  const progressPercent = itemCount > 0 ? Math.round((checkedCount / itemCount) * 100) : 0;
  const phaseLabel = phase === 'leaving' ? 'Packed before leaving' : 'Confirmed before going home';
  const isItemCheckedForPhase = (item: OutsideSessionItemWithContext) =>
    phase === 'leaving' ? Boolean(item.is_checked) : Boolean(item.return_checked);
  const displayedItems = [...items].sort((a, b) =>
    Number(isItemCheckedForPhase(a)) - Number(isItemCheckedForPhase(b))
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#f8f9fa' }]} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#f8f9fa' }]} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: '#d32f2f' }]}>{error || 'Session not found'}</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: PRIMARY }]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item, index }: { item: OutsideSessionItemWithContext; index: number }) => {
    const checked = isItemCheckedForPhase(item);
    const leavingChecked = Boolean(item.is_checked);
    const wasMoved = leavingChecked && !!item.moved_to_space_name;
    const isLent = !!item.active_borrower_name;
    const spaceName = item.space_name && item.space_name !== 'Unknown Space' ? item.space_name : null;
    const containerName = item.container_name ?? null;
    const originalLocation = containerName ? `${spaceName ?? ''} › ${containerName}` : spaceName;
    const movedLocation = item.moved_to_container_name
      ? `${item.moved_to_space_name} › ${item.moved_to_container_name}`
      : item.moved_to_space_name;
    const locationLine = isLent
      ? `Lent to ${item.active_borrower_name}`
      : wasMoved
      ? `→ ${movedLocation}`
      : originalLocation;
    const issueLabel = item.issue_status === 'LOST'
      ? 'Reported lost'
      : item.issue_status === 'NOT_BROUGHT'
      ? 'Forgot to bring'
      : null;
    const locationColor = isLent
      ? LENDING
      : wasMoved
      ? (isDark ? '#4ade80' : '#6b9e7a')
      : subtleText;
    const checkColor = phase === 'returning'
      ? (isDark ? '#4ade80' : '#6b9e7a')
      : wasMoved
      ? (isDark ? '#4ade80' : '#6b9e7a')
      : PRIMARY;

    return (
      <TouchableOpacity
        style={[
          styles.itemRow,
          index < displayedItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
          checked && { opacity: 0.65 },
        ]}
        onPress={() => phase === 'leaving' ? handleToggleItem(item) : handleToggleReturnItem(item)}
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
              { color: colors.text },
            ]}
            numberOfLines={1}
          >
            {item.item_name}
          </Text>
          {locationLine && (
            <Text
              style={[styles.itemLocation, { color: locationColor }]}
              numberOfLines={1}
            >
              {locationLine}
            </Text>
          )}
          {issueLabel && (
            <Text style={[styles.itemIssue, { color: item.issue_status === 'LOST' ? '#d32f2f' : '#f57c00' }]}>
              {issueLabel}
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
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
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
        <View style={[styles.phaseSwitch, { backgroundColor: isDark ? '#2c2c2e' : '#eef1f4' }]}>
          <TouchableOpacity
            style={[styles.phaseButton, phase === 'leaving' && { backgroundColor: cardBg }]}
            onPress={() => setPhase('leaving')}
            activeOpacity={0.75}
          >
            <Text style={[styles.phaseButtonText, { color: phase === 'leaving' ? PRIMARY : subtleText }]}>
              Leaving
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.phaseButton, phase === 'returning' && { backgroundColor: cardBg }]}
            onPress={handleStartGoingHomeCheck}
            activeOpacity={0.75}
          >
            <Text style={[styles.phaseButtonText, { color: phase === 'returning' ? PRIMARY : subtleText }]}>
              Going home
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progressLabelRow}>
          <Text style={[styles.progressLabel, { color: subtleText }]}>
            {checkedCount} of {itemCount} {phase === 'leaving' ? 'packed' : 'confirmed'}
          </Text>
          <Text style={[styles.progressPercent, { color: progressPercent === 100 ? (isDark ? '#4ade80' : '#6b9e7a') : PRIMARY }]}>
            {progressPercent}%
          </Text>
        </View>
        <Text style={[styles.phaseHint, { color: subtleText }]}>{phaseLabel}</Text>
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
            <Text style={[styles.emptyHint, { color: subtleText }]}>Tap &quot;+ Add Items&quot; to get started</Text>
          </View>
        ) : (
          <FlatList
            data={displayedItems}
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
            onPress={() => phase === 'leaving' ? setShowItemPicker(true) : setPhase('leaving')}
          >
            <Text style={[styles.outlineButtonText, { color: PRIMARY }]}>
              {phase === 'leaving' ? '+ Add Items' : 'Back to Leaving'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1, backgroundColor: PRIMARY }]}
            onPress={() => phase === 'leaving' ? handleStartGoingHomeCheck() : handleCompleteSession()}
          >
            <Text style={styles.primaryButtonText}>{phase === 'leaving' ? 'Going Home Check' : 'End Session'}</Text>
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

      <Modal visible={showLostReportModal} transparent animationType="slide" onRequestClose={() => setShowLostReportModal(false)}>
        <KeyboardAvoidingView
          style={styles.sheetOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.uncheckSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 + keyboardHeight }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Report lost item</Text>
            <Text style={[styles.sheetSubtitle, { color: subtleText }]}>
              Add an optional note. It will appear in the item details until the item is marked found.
            </Text>
            <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
              <Text style={[styles.moveSectionLabel, { color: subtleText }]}>
                {lostReportItems.length} item{lostReportItems.length === 1 ? '' : 's'}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: colors.text }]}>
                {lostReportItems.slice(0, 3).map(item => item.item_name).join(', ')}
                {lostReportItems.length > 3 ? ` and ${lostReportItems.length - 3} more` : ''}
              </Text>
              <TextInput
                style={[styles.lostNoteInput, { backgroundColor: isDark ? '#2c2c2e' : '#f8f9fa', borderColor }]}
                value={lostReportComment}
                onChangeText={setLostReportComment}
                placeholder="Add a short note"
                placeholderTextColor={subtleText}
                multiline
                textAlignVertical="top"
                maxLength={240}
              />
            </View>
            <View style={styles.uncheckActions}>
              <TouchableOpacity style={[styles.uncheckBtn, { borderColor }]} onPress={() => setShowLostReportModal(false)}>
                <Text style={[styles.uncheckBtnText, { color: subtleText }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#d32f2f' }]} onPress={submitLostReport}>
                <Text style={styles.confirmBtnText}>Report Lost</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
      <Modal visible={showPutAwaySheet} transparent animationType="slide" onRequestClose={dismissPutAwaySheet}>
        <TouchableWithoutFeedback onPress={dismissPutAwaySheet}>
          <View style={styles.sheetBackdrop} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {isWrapUpMode ? `Wrap Up ${wrapUpIndex + 1}/${wrapUpItems.length}` : 'Check Off'}
          </Text>
          <Text style={[styles.sheetSubtitle, { color: subtleText }]}>
            {isWrapUpMode
              ? `Where did "${putAwayItem?.item_name}" end up?`
              : `What do you want to do with "${putAwayItem?.item_name}"?`}
          </Text>
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: isDark ? '#2c2c2e' : '#f8f9fa', borderColor }]}
              onPress={handlePutAwayOriginal}
              disabled={wrapUpLoading}
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
              disabled={wrapUpLoading}
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
                setDueDate(null);
                setShowLendModal(true);
              }}
              disabled={wrapUpLoading}
              activeOpacity={0.7}
            >
              <FontAwesomeIcon icon={faHandshake} size={18} color={PRIMARY} />
              <View style={styles.sheetOptionText}>
                <Text style={[styles.sheetOptionLabel, { color: colors.text }]}>Lend to someone</Text>
                <Text style={[styles.sheetOptionDesc, { color: subtleText }]}>Track who you&apos;re lending this to</Text>
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.sheetCancel, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}
            onPress={dismissPutAwaySheet}
            disabled={wrapUpLoading}
          >
            <Text style={[styles.sheetCancelText, { color: PRIMARY }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Move Picker Modal */}
      <Modal visible={showMoveSheet} transparent animationType="slide" onRequestClose={closeMoveSheet}>
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
            onPress={closeMoveSheet}
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
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        onSubmit={handleLendSubmit}
        onCancel={() => {
          setShowLendModal(false);
          setBorrowerName('');
          setLendNote('');
          setDueDate(null);
          if (isWrapUpMode) {
            setShowPutAwaySheet(true);
          } else {
            setPutAwayItem(null);
          }
        }}
        loading={lendLoading}
      />
    </SafeAreaView>
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
    paddingTop: 8,
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
  phaseSwitch: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    gap: 3,
  },
  phaseButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseButtonText: { fontSize: 13, fontWeight: '700' },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 13 },
  progressPercent: { fontSize: 13, fontWeight: '600' },
  phaseHint: { fontSize: 12 },
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
  itemIssue: { fontSize: 12, marginTop: 2, fontWeight: '700' },
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
  uncheckActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  uncheckBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  uncheckBtnText: { fontSize: 16, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  lostNoteInput: {
    width: '100%',
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
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

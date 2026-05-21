/**
 * ItemDetailScreen
 *
 * View and manage a single item — shows full info, edit fields, and actions (Move, Lend, Delete)
 * Accessed via /item/[id] dynamic route
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { Item } from '@/src/models/Item';
import type { Space } from '@/src/models/Space';
import type { Container } from '@/src/models/Container';
import { ItemService } from '@/src/services/ItemService';
import { SpaceService } from '@/src/services/SpaceService';
import { ContainerService } from '@/src/services/ContainerService';
import { LendingService } from '@/src/features/lending/services/LendingService';
import { LendingRepository } from '@/src/features/lending/repositories/LendingRepository';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { PhotoService } from '@/src/services/PhotoService';
import PhotoActionSheet from '@/components/PhotoActionSheet';
import PhotoPickerSheet from '@/components/PhotoPickerSheet';
import PhotoViewModal from '@/components/PhotoViewModal';
import { Lending } from '@/src/features/lending/models/Lending';
import LendingFormModal from '@/src/features/lending/screens/components/LendingFormModal';
import { OutsideService } from '@/src/features/outside/services/OutsideService';
import { RecentItemService } from '@/src/services/RecentItemService';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBox, faHandshake, faCheck, faTrash, faMapPin, faFolder, faEllipsisVertical, faChevronLeft, faShield, faTriangleExclamation, faQrcode, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import DatePickerSheet from '@/src/features/lending/screens/components/DatePickerSheet';
import { parseDateOnly, startOfLocalDay } from '@/src/utils/dateOnly';

const PRIMARY = '#6b7f99';
const LENDING = '#9b72cb';
const WARRANTY = '#e09b3a';
const PACK_SIZE_PRESETS = [10, 12, 20, 24, 25, 30, 50, 100];

function getItemCount(quantity: number, contentsPerItem?: number | null) {
  const safeQuantity = Math.max(0, Math.floor(quantity) || 0);
  const safeContents = contentsPerItem ? Math.max(1, Math.floor(contentsPerItem) || 1) : null;
  return safeContents ? Math.ceil(safeQuantity / safeContents) : safeQuantity;
}

function getStoredQuantity(itemCount: number, contentsPerItem?: number | null) {
  const safeItemCount = Math.max(0, Math.floor(itemCount) || 0);
  const safeContents = contentsPerItem ? Math.max(1, Math.floor(contentsPerItem) || 1) : null;
  return safeContents ? safeItemCount * safeContents : safeItemCount;
}

export default function ItemDetailScreen() {
  const { id: itemId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [editingField, setEditingField] = useState<'name' | 'description' | 'quantity' | 'totalContents' | 'unitsPerPack' | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editTotalContents, setEditTotalContents] = useState('');
  const [editUnitsPerPack, setEditUnitsPerPack] = useState('');
  const [savingQuantity, setSavingQuantity] = useState(false);
  const [savingUnitsPerPack, setSavingUnitsPerPack] = useState(false);

  // Lending state
  const [activeLending, setActiveLending] = useState<Lending | null>(null);
  const [showLendModal, setShowLendModal] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const [lendQuantity, setLendQuantity] = useState('1');
  const [lendNote, setLendNote] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [lendLoading, setLendLoading] = useState(false);
  const [lendBeforePhotoUris, setLendBeforePhotoUris] = useState<string[]>([]);

  // Menu state
  const [showMenu, setShowMenu] = useState(false);
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  // Move state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [spaceContainers, setSpaceContainers] = useState<Record<string, Container[]>>({});

  // Warranty state
  const [showWarrantyPicker, setShowWarrantyPicker] = useState(false);
  const [warrantyLoading, setWarrantyLoading] = useState(false);

  const lendingService = useMemo(
    () => new LendingService(new LendingRepository(), new ItemRepository()),
    []
  );
  const outsideService = useMemo(() => new OutsideService(), []);

  const [activeOutsideSession, setActiveOutsideSession] = useState(false);

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const inputBg = isDark ? '#2c2c2e' : '#f8f9fa';

  useFocusEffect(
    useCallback(() => {
      if (itemId) loadItem();
      // loadItem intentionally reads the current repositories and route state.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemId])
  );

  async function loadItem() {
    setLoading(true);
    try {
      const [result, lendings, outsideIds] = await Promise.all([
        ItemService.getItemById(itemId!),
        lendingService.getActiveLendings(),
        outsideService.getActiveSessionItemIds(),
      ]);
      setItem(result);
      if (result?.id) {
        RecentItemService.recordOpened(result.id).catch((error) => {
          console.warn('[ItemDetailScreen] failed to record recent item:', error);
        });
      }
      const lending = lendings.find((l) => l.item_id === itemId);
      setActiveLending(lending ?? null);
      setActiveOutsideSession(outsideIds.has(itemId!));
    } catch (err) {
      console.error('[ItemDetailScreen] loadItem:', err);
      Alert.alert('Error', 'Failed to load item');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveField(field: 'name' | 'description' | 'quantity' | 'totalContents' | 'unitsPerPack') {
    if (!item) return;
    try {
      const updates: any = {};
      if (field === 'name') {
        if (!editName.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
        updates.name = editName.trim();
      } else if (field === 'description') {
        updates.description = editDescription.trim() || null;
      } else if (field === 'quantity') {
        updates.quantity = getStoredQuantity(parseInt(editQuantity) || 0, item.unitsPerPack);
      } else if (field === 'totalContents') {
        updates.quantity = Math.max(0, parseInt(editTotalContents) || 0);
      } else if (field === 'unitsPerPack') {
        updates.unitsPerPack = editUnitsPerPack.trim() ? Math.max(1, parseInt(editUnitsPerPack) || 1) : null;
      }
      await ItemService.updateItem(item.id, updates);
      setItem((current) => current ? { ...current, ...updates } : current);
      setEditingField(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update');
    }
  }

  function startEdit(field: 'name' | 'description' | 'quantity' | 'totalContents' | 'unitsPerPack') {
    if (!item) return;
    if (field === 'name') setEditName(item.name);
    else if (field === 'description') setEditDescription(item.description ?? '');
    else if (field === 'quantity') setEditQuantity(String(getItemCount(item.quantity, item.unitsPerPack)));
    else if (field === 'totalContents') setEditTotalContents(String(item.quantity));
    else if (field === 'unitsPerPack') setEditUnitsPerPack(item.unitsPerPack ? String(item.unitsPerPack) : '');
    setEditingField(field);
  }

  const persistQuantityDraft = useCallback(async (rollbackOnError = true) => {
    if (!item || savingQuantity) return;

    const nextQuantity = getStoredQuantity(parseInt(editQuantity, 10) || 0, item.unitsPerPack);
    if (nextQuantity === item.quantity && editQuantity === String(item.quantity)) return;

    setSavingQuantity(true);
    try {
      await ItemService.updateItem(item.id, { quantity: nextQuantity });
      setEditQuantity(String(getItemCount(nextQuantity, item.unitsPerPack)));
      setItem((current) => current ? { ...current, quantity: nextQuantity } : current);
    } catch {
      if (rollbackOnError) setEditQuantity(String(getItemCount(item.quantity, item.unitsPerPack)));
      Alert.alert('Error', 'Failed to update stock');
    } finally {
      setSavingQuantity(false);
    }
  }, [editQuantity, item, savingQuantity]);

  const persistTotalContentsDraft = useCallback(async (rollbackOnError = true) => {
    if (!item || savingQuantity) return;

    const nextQuantity = Math.max(0, Math.floor(parseInt(editTotalContents, 10)) || 0);
    if (nextQuantity === item.quantity && editTotalContents === String(item.quantity)) return;

    setSavingQuantity(true);
    try {
      await ItemService.updateItem(item.id, { quantity: nextQuantity });
      setEditTotalContents(String(nextQuantity));
      setItem((current) => current ? { ...current, quantity: nextQuantity } : current);
    } catch {
      if (rollbackOnError) setEditTotalContents(String(item.quantity));
      Alert.alert('Error', 'Failed to update total contents');
    } finally {
      setSavingQuantity(false);
    }
  }, [editTotalContents, item, savingQuantity]);

  const persistUnitsPerPackDraft = useCallback(async (rollbackOnError = true) => {
    if (!item || savingUnitsPerPack) return;

    const nextUnitsPerPack = editUnitsPerPack.trim()
      ? Math.max(1, Math.floor(parseInt(editUnitsPerPack, 10)) || 1)
      : null;
    if ((nextUnitsPerPack ?? null) === (item.unitsPerPack ?? null)) return;

    setSavingUnitsPerPack(true);
    try {
      const currentItemCount = getItemCount(item.quantity, item.unitsPerPack);
      const nextQuantity = nextUnitsPerPack ? getStoredQuantity(currentItemCount, nextUnitsPerPack) : currentItemCount;
      await ItemService.updateItem(item.id, { unitsPerPack: nextUnitsPerPack, quantity: nextQuantity });
      setEditUnitsPerPack(nextUnitsPerPack ? String(nextUnitsPerPack) : '');
      setItem((current) => current ? { ...current, unitsPerPack: nextUnitsPerPack, quantity: nextQuantity } : current);
    } catch {
      if (rollbackOnError) setEditUnitsPerPack(item.unitsPerPack ? String(item.unitsPerPack) : '');
      Alert.alert('Error', 'Failed to update contents per item');
    } finally {
      setSavingUnitsPerPack(false);
    }
  }, [editUnitsPerPack, item, savingUnitsPerPack]);

  useEffect(() => {
    if (editingField !== 'quantity' || !item || savingQuantity) return;
    if (editQuantity.trim() === '') return;

    const nextQuantity = Math.max(0, Math.floor(parseInt(editQuantity, 10)) || 0);
    if (nextQuantity === item.quantity && editQuantity === String(item.quantity)) return;

    const timeout = setTimeout(() => {
      persistQuantityDraft();
    }, 650);

    return () => clearTimeout(timeout);
  }, [editQuantity, editingField, item, persistQuantityDraft, savingQuantity]);

  useEffect(() => {
    if (editingField !== 'totalContents' || !item || savingQuantity) return;
    if (editTotalContents.trim() === '') return;

    const nextQuantity = Math.max(0, Math.floor(parseInt(editTotalContents, 10)) || 0);
    if (nextQuantity === item.quantity && editTotalContents === String(item.quantity)) return;

    const timeout = setTimeout(() => {
      persistTotalContentsDraft();
    }, 650);

    return () => clearTimeout(timeout);
  }, [editTotalContents, editingField, item, persistTotalContentsDraft, savingQuantity]);

  useEffect(() => {
    if (editingField !== 'unitsPerPack' || !item || savingUnitsPerPack) return;

    const nextUnitsPerPack = editUnitsPerPack.trim()
      ? Math.max(1, Math.floor(parseInt(editUnitsPerPack, 10)) || 1)
      : null;
    if ((nextUnitsPerPack ?? null) === (item.unitsPerPack ?? null)) return;

    const timeout = setTimeout(() => {
      persistUnitsPerPackDraft();
    }, 650);

    return () => clearTimeout(timeout);
  }, [editUnitsPerPack, editingField, item, persistUnitsPerPackDraft, savingUnitsPerPack]);

  async function adjustStock(delta: number) {
    if (!item) return;
    const step = item.unitsPerPack ? Math.max(1, item.unitsPerPack) : 1;
    const nextQuantity = Math.max(0, item.quantity + (delta * step));
    if (nextQuantity === item.quantity) return;
    try {
      await ItemService.updateItem(item.id, { quantity: nextQuantity });
      setItem((current) => current ? { ...current, quantity: nextQuantity } : current);
      if (editingField === 'quantity') setEditQuantity(String(getItemCount(nextQuantity, item.unitsPerPack)));
      if (editingField === 'totalContents') setEditTotalContents(String(nextQuantity));
    } catch {
      Alert.alert('Error', 'Failed to update stock');
    }
  }

  async function adjustTotalContents(delta: number) {
    if (!item) return;
    const nextQuantity = Math.max(0, item.quantity + delta);
    if (nextQuantity === item.quantity) return;
    try {
      await ItemService.updateItem(item.id, { quantity: nextQuantity });
      setItem((current) => current ? { ...current, quantity: nextQuantity } : current);
      if (editingField === 'quantity') setEditQuantity(String(getItemCount(nextQuantity, item.unitsPerPack)));
      if (editingField === 'totalContents') setEditTotalContents(String(nextQuantity));
    } catch {
      Alert.alert('Error', 'Failed to update total contents');
    }
  }

  async function updateUnitsPerPack(nextValue: number | null) {
    if (!item) return;
    try {
      const itemCount = getItemCount(item.quantity, item.unitsPerPack);
      const nextQuantity = nextValue ? getStoredQuantity(itemCount, nextValue) : itemCount;
      await ItemService.updateItem(item.id, { unitsPerPack: nextValue, quantity: nextQuantity });
      setItem((current) => current ? { ...current, unitsPerPack: nextValue, quantity: nextQuantity } : current);
      if (editingField === 'unitsPerPack') setEditUnitsPerPack(nextValue ? String(nextValue) : '');
      if (editingField === 'quantity') setEditQuantity(String(getItemCount(nextQuantity, nextValue)));
      if (editingField === 'totalContents') setEditTotalContents(String(nextQuantity));
    } catch {
      Alert.alert('Error', 'Failed to update contents per item');
    }
  }

  function adjustUnitsPerPack(delta: number) {
    const current = item?.unitsPerPack ?? 0;
    const nextValue = Math.max(0, current + delta);
    updateUnitsPerPack(nextValue > 0 ? nextValue : null);
  }

  async function handleAddPhoto(source: 'camera' | 'gallery') {
    if (!item || !itemId) return;
    setShowPhotoPicker(false);
    try {
      const tempUri = source === 'camera'
        ? await PhotoService.captureFromCamera()
        : await PhotoService.pickFromGallery();
      if (!tempUri) return;
      // Delete old photo if replacing
      if (item.photoUri) await PhotoService.deletePhoto(item.photoUri);
      const savedUri = await PhotoService.savePhoto(tempUri, itemId);
      await ItemRepository.updatePhotoUri(itemId, savedUri);
      await loadItem();
    } catch {
      Alert.alert('Error', 'Failed to save photo');
    }
  }

  async function handleRemovePhoto() {
    if (!itemId) return;
    try {
      if (item?.photoUri) await PhotoService.deletePhoto(item.photoUri);
      await ItemRepository.updatePhotoUri(itemId, null);
      await loadItem();
    } catch {
      Alert.alert('Error', 'Failed to remove photo');
    }
  }

  // Move
  async function openMoveModal() {
    try {
      const spaces = await SpaceService.getAllSpaces();
      setAllSpaces(spaces);
      const containersMap: Record<string, Container[]> = {};
      await Promise.all(
        spaces.map(async (s) => {
          const cs = await ContainerService.getContainersBySpaceId(String(s.id));
          containersMap[String(s.id)] = cs;
        })
      );
      setSpaceContainers(containersMap);
      setShowMoveModal(true);
    } catch {
      Alert.alert('Error', 'Failed to load spaces');
    }
  }

  async function handleMoveToSpace(spaceId: string) {
    if (!item) return;
    setShowMoveModal(false);
    try {
      if (spaceId === item.spaceId) {
        // Moving to root of the same space — just clear the container
        await ItemService.moveItemToContainer(item.id, spaceId, '');
      } else {
        // Moving to a different space — update space_id and clear container
        await ItemService.moveItem(item.id, item.spaceId, spaceId);
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to move item');
    }
  }

  async function handleMoveToContainer(spaceId: string, containerId: string) {
    if (!item) return;
    setShowMoveModal(false);
    try {
      await ItemService.moveItemToContainer(item.id, spaceId, containerId);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to move item');
    }
  }

  // Lend
  async function handleLendSubmit() {
    if (!borrowerName.trim() || !item) return;
    const quantity = Math.max(1, Math.floor(Number(lendQuantity) || 1));
    setLendLoading(true);
    try {
      const lending = await lendingService.createLending({
        item_id: item.id,
        borrower_name: borrowerName.trim(),
        quantity,
        note: lendNote.trim() || undefined,
        due_date: dueDate ?? undefined,
      });
      let failedPhotoCount = 0;
      for (const uri of lendBeforePhotoUris) {
        try {
          await lendingService.addPhoto(lending.id, 'before', uri);
        } catch {
          failedPhotoCount += 1;
        }
      }
      setShowLendModal(false);
      setBorrowerName('');
      setLendQuantity('1');
      setLendNote('');
      setDueDate(null);
      setLendBeforePhotoUris([]);
      await loadItem();
      if (failedPhotoCount > 0) {
        Alert.alert('Photo not saved', `The lending was created, but ${failedPhotoCount} before photo${failedPhotoCount === 1 ? '' : 's'} could not be added.`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.code === 'DUPLICATE_ACTIVE_LENDING'
        ? 'This item is already lent out'
        : err.message || 'Failed to lend item');
    } finally {
      setLendLoading(false);
    }
  }

  async function handleMarkReturned() {
    if (!activeLending) return;
    try {
      await lendingService.markAsReturned(activeLending.id);
      await loadItem();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to mark as returned');
    }
  }

  async function handleMarkFound() {
    if (!item) return;
    try {
      await ItemRepository.markFound(item.id);
      await loadItem();
    } catch {
      Alert.alert('Error', 'Failed to mark item as found');
    }
  }

  // Delete
  function handleDelete() {
    if (!item) return;
    Alert.alert('Delete Item', `Delete "${item.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await ItemService.deleteItem(item.id);
            router.back();
          } catch {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
  }

  // Warranty
  const [warrantyPickerDate, setWarrantyPickerDate] = useState<Date>(new Date());

  function openWarrantyPicker() {
    setWarrantyPickerDate(
      item?.warrantyExpiry ? parseDateOnly(item.warrantyExpiry) : new Date()
    );
    setShowWarrantyPicker(true);
  }

  async function handleWarrantyDone() {
    if (!item) return;
    setShowWarrantyPicker(false);
    setWarrantyLoading(true);
    try {
      const locationName = item.container?.name ?? item.space?.name ?? 'Unknown';
      await ItemService.updateWarranty(item.id, warrantyPickerDate, locationName);
      await loadItem();
    } catch {
      Alert.alert('Error', 'Failed to save warranty date');
    } finally {
      setWarrantyLoading(false);
    }
  }

  async function handleClearWarranty() {
    if (!item) return;
    Alert.alert('Remove Warranty', 'Remove the warranty date and cancel reminders?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setWarrantyLoading(true);
          try {
            await ItemService.clearWarranty(item.id);
            await loadItem();
          } catch {
            Alert.alert('Error', 'Failed to remove warranty');
          } finally {
            setWarrantyLoading(false);
          }
        },
      },
    ]);
  }

  function getWarrantyStatus(expiryStr: string): { label: string; color: string } {
    const today = startOfLocalDay(new Date());
    const expiry = parseDateOnly(expiryStr);
    const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    if (days < 0) return { label: 'Expired', color: '#e53e3e' };
    if (days <= 30) return { label: 'Expiring Soon', color: WARRANTY };
    return { label: 'Active', color: '#6b9e7a' };
  }

  function openPrintableLabel() {
    if (!item) return;
    setShowMenu(false);
    router.push({
      pathname: '/tools/label-qr' as any,
      params: {
        targetKind: 'item',
        targetId: item.id,
      },
    });
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#f8f9fa', paddingTop: insets.top }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#f8f9fa', paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.text }]}>Item not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: PRIMARY, marginTop: 12 }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isLent = !!activeLending;
  const isOutside = activeOutsideSession;
  const isLost = !!item.lostAt;
  const locationText = item.container?.name
    ? `${item.space?.name ?? 'Unknown'} › ${item.container.name}`
    : item.space?.name ?? 'Unknown space';

  const outsideGuard = () =>
    Alert.alert(
      'Item is Outside',
      'This item is in an active outside session. Complete or remove it from the session before moving or lending it.'
    );

  const lendingGuard = () =>
    Alert.alert(
      'Item is Lent Out',
      'This item is currently lent out. Mark it as returned before moving it.'
    );

  const lostGuard = () =>
    Alert.alert(
      'Item is Lost',
      'Mark this item as found before moving or lending it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark Found', onPress: handleMarkFound },
      ]
    );

  const noStockGuard = () =>
    Alert.alert('No stock available', 'Add stock before lending this item.');

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: borderColor, paddingTop: insets.top, backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <FontAwesomeIcon icon={faChevronLeft} size={18} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Item Details</Text>
        <TouchableOpacity onPress={() => setShowMenu(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.menuBtn}>
          <FontAwesomeIcon icon={faEllipsisVertical} size={20} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {isLost && (
          <View style={[styles.lendingBanner, { backgroundColor: '#d32f2f15', borderColor: '#d32f2f40' }]}>
            <FontAwesomeIcon icon={faTriangleExclamation} size={16} color="#d32f2f" />
            <Text style={[styles.lendingBannerText, { color: '#d32f2f', flex: 1 }]}>
              Reported lost{item.lostAt ? ` · ${new Date(item.lostAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
            </Text>
            <TouchableOpacity style={[styles.foundBtn, { backgroundColor: '#d32f2f18' }]} onPress={handleMarkFound}>
              <Text style={styles.foundBtnText}>Found</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLost && item.lostNote && (
          <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor: '#d32f2f40' }]}>
            <Text style={[styles.fieldLabel, { color: '#d32f2f' }]}>Lost note</Text>
            <Text style={[styles.fieldValue, { color: colors.text }]}>{item.lostNote}</Text>
          </View>
        )}

        {/* Lending badge */}
        {isLent && (
          <View style={[styles.lendingBanner, { backgroundColor: `${LENDING}15`, borderColor: `${LENDING}40` }]}>
            <FontAwesomeIcon icon={faHandshake} size={16} color={LENDING} />
            <Text style={[styles.lendingBannerText, { color: LENDING }]}>
              Lent to {activeLending.borrower_name}
              {activeLending.lent_at ? ` · since ${new Date(activeLending.lent_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
            </Text>
          </View>
        )}

        {/* Outside session badge */}
        {isOutside && (
          <View style={[styles.lendingBanner, { backgroundColor: '#e67e2215', borderColor: '#e67e2240' }]}>
            <FontAwesomeIcon icon={faMapPin} size={16} color="#e67e22" />
            <Text style={[styles.lendingBannerText, { color: '#e67e22' }]}>
              In active outside session · Complete the session before moving or lending
            </Text>
          </View>
        )}

        {/* Photo */}
        {item.photoUri ? (
          <TouchableOpacity
            style={[styles.photoCard, { backgroundColor: cardBg, borderColor }]}
            onPress={() => setShowPhotoActions(true)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: item.photoUri }} style={styles.photoFull} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.addPhotoBtn, { backgroundColor: cardBg, borderColor }]}
            onPress={() => setShowPhotoPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.addPhotoText, { color: subtleText }]}>+ Add Photo</Text>
          </TouchableOpacity>
        )}

        {/* Name */}
        <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.fieldLabel, { color: subtleText }]}>Name</Text>
          {editingField === 'name' ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, { color: colors.text, backgroundColor: inputBg, borderColor }]}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                maxLength={100}
              />
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: PRIMARY }]} onPress={() => handleSaveField('name')}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingField(null)}>
                <Text style={[styles.cancelText, { color: subtleText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => startEdit('name')}>
              <Text style={[styles.fieldValue, { color: colors.text }]}>{item.name}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Description */}
        <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.fieldLabel, { color: subtleText }]}>Description</Text>
          {editingField === 'description' ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, styles.editInputMultiline, { color: colors.text, backgroundColor: inputBg, borderColor }]}
                value={editDescription}
                onChangeText={setEditDescription}
                autoFocus
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: PRIMARY }]} onPress={() => handleSaveField('description')}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingField(null)}>
                <Text style={[styles.cancelText, { color: subtleText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => startEdit('description')}>
              <Text style={[styles.fieldValue, { color: item.description ? colors.text : subtleText }]}>
                {item.description || 'Tap to add description'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quantity */}
        <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.fieldLabel, { color: subtleText }]}>Item count</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[styles.stepperButton, { borderColor, opacity: item.quantity <= 0 ? 0.45 : 1 }]}
              onPress={() => adjustStock(-1)}
              disabled={item.quantity <= 0}
            >
              <FontAwesomeIcon icon={faMinus} size={13} color={item.quantity <= 0 ? subtleText : PRIMARY} />
            </TouchableOpacity>
            {editingField === 'quantity' ? (
              <View style={[styles.stepperValueWrap, { backgroundColor: inputBg, borderColor }]}>
                <TextInput
                    style={[styles.stepperInput, { color: colors.text }]}
                    value={editQuantity}
                    onChangeText={(t) => setEditQuantity(t.replace(/[^0-9]/g, ''))}
                    onBlur={() => persistQuantityDraft()}
                    onSubmitEditing={() => persistQuantityDraft()}
                    autoFocus
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={4}
                    editable={!savingQuantity}
                  />
              </View>
            ) : (
              <TouchableOpacity onPress={() => startEdit('quantity')} style={[styles.stepperValueWrap, { backgroundColor: inputBg, borderColor }]}>
                <Text style={[styles.stepperValue, { color: colors.text }]}>{getItemCount(item.quantity, item.unitsPerPack)}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.stepperButton, { borderColor }]}
              onPress={() => adjustStock(1)}
            >
              <FontAwesomeIcon icon={faPlus} size={13} color={PRIMARY} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.stockHint, { color: subtleText }]}>
            {item.unitsPerPack ? `Each step changes ${item.unitsPerPack} total contents.` : 'Count whole items you have in stock.'}
          </Text>
        </View>

        {item.unitsPerPack ? (
          <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.fieldLabel, { color: subtleText }]}>Total contents</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperButton, { borderColor, opacity: item.quantity <= 0 ? 0.45 : 1 }]}
                onPress={() => adjustTotalContents(-1)}
                disabled={item.quantity <= 0}
              >
                <FontAwesomeIcon icon={faMinus} size={13} color={item.quantity <= 0 ? subtleText : PRIMARY} />
              </TouchableOpacity>
              {editingField === 'totalContents' ? (
                <View style={[styles.stepperValueWrap, { backgroundColor: inputBg, borderColor }]}>
                  <TextInput
                    style={[styles.stepperInput, { color: colors.text }]}
                    value={editTotalContents}
                    onChangeText={(t) => setEditTotalContents(t.replace(/[^0-9]/g, ''))}
                    onBlur={() => persistTotalContentsDraft()}
                    onSubmitEditing={() => persistTotalContentsDraft()}
                    autoFocus
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={5}
                    editable={!savingQuantity}
                  />
                </View>
              ) : (
                <TouchableOpacity onPress={() => startEdit('totalContents')} style={[styles.stepperValueWrap, { backgroundColor: inputBg, borderColor }]}>
                  <Text style={[styles.stepperValue, { color: colors.text }]}>{item.quantity}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.stepperButton, { borderColor }]}
                onPress={() => adjustTotalContents(1)}
              >
                <FontAwesomeIcon icon={faPlus} size={13} color={PRIMARY} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.stockHint, { color: subtleText }]}>Use this when one content unit is sold or used.</Text>
          </View>
        ) : null}

        {/* Pack size */}
        <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.fieldLabel, { color: subtleText }]}>Contents per item</Text>
          {editingField === 'unitsPerPack' ? (
            <>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepperButton, { borderColor, opacity: !item.unitsPerPack ? 0.45 : 1 }]}
                  onPress={() => adjustUnitsPerPack(-1)}
                  disabled={!item.unitsPerPack}
                >
                  <FontAwesomeIcon icon={faMinus} size={13} color={!item.unitsPerPack ? subtleText : PRIMARY} />
                </TouchableOpacity>
                <View style={[styles.stepperValueWrap, { backgroundColor: inputBg, borderColor }]}>
                  <TextInput
                    style={[styles.stepperInput, { color: colors.text }]}
                    value={editUnitsPerPack}
                    onChangeText={(t) => setEditUnitsPerPack(t.replace(/[^0-9]/g, ''))}
                    onBlur={() => persistUnitsPerPackDraft()}
                    onSubmitEditing={() => persistUnitsPerPackDraft()}
                    autoFocus
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={5}
                    editable={!savingUnitsPerPack}
                    placeholder="0"
                    placeholderTextColor={subtleText}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.stepperButton, { borderColor }]}
                  onPress={() => adjustUnitsPerPack(1)}
                >
                  <FontAwesomeIcon icon={faPlus} size={13} color={PRIMARY} />
                </TouchableOpacity>
              </View>
              <View style={styles.presetRow}>
                {PACK_SIZE_PRESETS.map((preset) => {
                  const active = item.unitsPerPack === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.presetChip, { backgroundColor: active ? PRIMARY : inputBg, borderColor }]}
                      onPress={() => updateUnitsPerPack(preset)}
                    >
                      <Text style={[styles.presetChipText, { color: active ? '#ffffff' : colors.text }]}>{preset}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.editActionsRow}>
                <TouchableOpacity
                  style={[styles.secondaryMiniBtn, { borderColor }]}
                  onPress={() => setEditingField(null)}
                >
                  <Text style={[styles.secondaryMiniBtnText, { color: subtleText }]}>Done</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : item.unitsPerPack ? (
            <View style={styles.protectedValueRow}>
              <View style={[styles.protectedValueBox, { backgroundColor: inputBg, borderColor }]}>
                <Text style={[styles.stepperValue, { color: colors.text }]}>{item.unitsPerPack}</Text>
              </View>
              <TouchableOpacity
                style={[styles.secondaryMiniBtn, { borderColor }]}
                onPress={() => startEdit('unitsPerPack')}
              >
                <Text style={[styles.secondaryMiniBtnText, { color: PRIMARY }]}>Edit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.enableContentsBtn, { backgroundColor: inputBg, borderColor }]}
              onPress={() => startEdit('unitsPerPack')}
              activeOpacity={0.75}
            >
              <Text style={[styles.enableContentsText, { color: colors.text }]}>Enable contents tracking</Text>
              <Text style={[styles.stockHint, { color: subtleText }]}>For packs, tubs, boxes, or containers with units inside.</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.stockHint, { color: subtleText }]}>Set this to how many sellable contents are inside one item.</Text>
        </View>

        {/* Location */}
        <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.fieldLabel, { color: subtleText }]}>Location</Text>
          <View style={styles.locationTrail}>
            {item.space ? (
              <TouchableOpacity
                style={[styles.locationPill, { backgroundColor: inputBg, borderColor }]}
                onPress={() => router.dismissTo({ pathname: '/space/[id]' as any, params: { id: item.spaceId } })}
                activeOpacity={0.75}
              >
                <FontAwesomeIcon icon={faMapPin} size={11} color={PRIMARY} />
                <Text style={[styles.locationPillText, { color: PRIMARY }]} numberOfLines={1}>{item.space.name}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>{locationText}</Text>
            )}
            {item.container ? (
              <>
                <Text style={[styles.locationSeparator, { color: subtleText }]}>/</Text>
                <TouchableOpacity
                  style={[styles.locationPill, { backgroundColor: inputBg, borderColor }]}
                  onPress={() => router.dismissTo({ pathname: '/container/[id]' as any, params: { id: item.containerId } })}
                  activeOpacity={0.75}
                >
                  <FontAwesomeIcon icon={faFolder} size={11} color={PRIMARY} />
                  <Text style={[styles.locationPillText, { color: PRIMARY }]} numberOfLines={1}>{item.container.name}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>

        {/* Created */}
        <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.fieldLabel, { color: subtleText }]}>Added</Text>
          <Text style={[styles.fieldValue, { color: colors.text }]}>
            {new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {/* Warranty */}
        <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.warrantyHeader}>
            <FontAwesomeIcon icon={faShield} size={14} color={WARRANTY} />
            <Text style={[styles.fieldLabel, { color: subtleText, marginBottom: 0 }]}>Warranty</Text>
            {item.warrantyExpiry && (
              <View style={[styles.warrantyBadge, { backgroundColor: `${getWarrantyStatus(item.warrantyExpiry).color}18` }]}>
                <Text style={[styles.warrantyBadgeText, { color: getWarrantyStatus(item.warrantyExpiry).color }]}>
                  {getWarrantyStatus(item.warrantyExpiry).label}
                </Text>
              </View>
            )}
          </View>
          {warrantyLoading ? (
            <ActivityIndicator size="small" color={WARRANTY} style={{ marginTop: 8 }} />
          ) : item.warrantyExpiry ? (
            <View style={styles.warrantyRow}>
              <Text style={[styles.fieldValue, { color: colors.text, flex: 1 }]}>
                {parseDateOnly(item.warrantyExpiry).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={openWarrantyPicker} style={styles.warrantyEditBtn}>
                <Text style={[styles.warrantyEditText, { color: WARRANTY }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClearWarranty} style={styles.warrantyEditBtn}>
                <Text style={[styles.warrantyEditText, { color: '#e53e3e' }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={openWarrantyPicker} style={{ marginTop: 6 }}>
              <Text style={[styles.fieldValue, { color: subtleText }]}>Tap to add warranty expiry date</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Warranty Date Picker */}
        <DatePickerSheet
          visible={showWarrantyPicker}
          onClose={() => setShowWarrantyPicker(false)}
          onConfirm={handleWarrantyDone}
          onChange={setWarrantyPickerDate}
          value={warrantyPickerDate}
          minimumDate={new Date()}
          purpose="warranty"
          textColor={colors.text}
          subtleText={subtleText}
          cardBg={cardBg}
          borderColor={borderColor}
          isDark={isDark}
        />

      </ScrollView>

      {/* Action Menu */}
      <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
                <Text style={[styles.menuTitle, { color: colors.text }]}>Item actions</Text>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: borderColor, borderBottomWidth: 1 }]}
              onPress={() => { setShowMenu(false); if (isLost) { lostGuard(); } else if (isOutside) { outsideGuard(); } else if (isLent) { lendingGuard(); } else { openMoveModal(); } }}
            >
              <FontAwesomeIcon icon={faBox} size={18} color={isLost ? '#d32f2f' : isOutside ? '#e67e22' : isLent ? '#e67e22' : PRIMARY} />
              <Text style={[styles.menuItemText, { color: isLost ? '#d32f2f' : isOutside ? '#e67e22' : isLent ? '#e67e22' : colors.text }]}>Move to...</Text>
            </TouchableOpacity>
            {isLent ? (
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: borderColor, borderBottomWidth: 1 }]} onPress={() => { setShowMenu(false); handleMarkReturned(); }}>
                <FontAwesomeIcon icon={faCheck} size={18} color={PRIMARY} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>Mark as returned</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: borderColor, borderBottomWidth: 1 }]}
              onPress={() => { setShowMenu(false); if (isLost) { lostGuard(); } else if (isOutside) { outsideGuard(); } else if (item.quantity <= 0) { noStockGuard(); } else { setBorrowerName(''); setLendQuantity('1'); setLendNote(''); setDueDate(null); setLendBeforePhotoUris([]); setShowLendModal(true); } }}
              >
                <FontAwesomeIcon icon={faHandshake} size={18} color={isLost ? '#d32f2f' : isOutside ? '#e67e22' : PRIMARY} />
                <Text style={[styles.menuItemText, { color: isLost ? '#d32f2f' : isOutside ? '#e67e22' : colors.text }]}>Lend item</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: borderColor, borderBottomWidth: 1 }]}
              onPress={openPrintableLabel}
            >
              <FontAwesomeIcon icon={faQrcode} size={18} color={PRIMARY} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Print item label</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handleDelete(); }}>
              <FontAwesomeIcon icon={faTrash} size={18} color="#e53e3e" />
              <Text style={[styles.menuItemText, { color: '#e53e3e' }]}>Delete item</Text>
            </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Lend Modal */}
      <LendingFormModal
        visible={showLendModal}
        item={item}
        borrowerName={borrowerName}
        onBorrowerNameChange={setBorrowerName}
        quantity={lendQuantity}
        onQuantityChange={setLendQuantity}
        note={lendNote}
        onNoteChange={setLendNote}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        onSubmit={handleLendSubmit}
        onCancel={() => { setShowLendModal(false); setBorrowerName(''); setLendQuantity('1'); setLendNote(''); setDueDate(null); setLendBeforePhotoUris([]); }}
        loading={lendLoading}
        beforePhotoUris={lendBeforePhotoUris}
        onBeforePhotosChange={setLendBeforePhotoUris}
      />

      {/* Move Modal */}
      <Modal visible={showMoveModal} transparent animationType="slide" onRequestClose={() => setShowMoveModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowMoveModal(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.moveSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
            <Text style={[styles.moveSheetTitle, { color: colors.text }]}>Move Item</Text>
            <ScrollView showsVerticalScrollIndicator={false}>

              {/* All destinations, grouped by space — current location shown disabled inline */}
              {allSpaces.map((s) => {
                const isCurrentSpace = s.id === item?.spaceId;
                const containers = spaceContainers[s.id] ?? [];
                const isRootCurrent = isCurrentSpace && !item?.containerId;
                return (
                  <View key={s.id}>
                    <Text style={[styles.moveSectionLabel, { color: subtleText }]}>
                      {isCurrentSpace ? 'IN THIS SPACE' : s.name.toUpperCase()}
                    </Text>
                    <TouchableOpacity
                      style={[styles.moveOption, isRootCurrent && styles.moveOptionDisabled, { borderColor }]}
                      onPress={isRootCurrent ? undefined : () => handleMoveToSpace(s.id)}
                      activeOpacity={isRootCurrent ? 1 : 0.7}
                    >
                      <FontAwesomeIcon icon={faMapPin} size={16} color={isRootCurrent ? subtleText : PRIMARY} />
                      <Text style={[styles.moveOptionText, { color: isRootCurrent ? subtleText : colors.text }]}>
                        {isCurrentSpace ? `Root of ${s.name}` : `${s.name} (root)`}
                      </Text>
                      {isRootCurrent && (
                        <View style={[styles.currentBadge, { backgroundColor: `${PRIMARY}18` }]}>
                          <Text style={[styles.currentBadgeText, { color: PRIMARY }]}>Here</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {containers.map((c) => {
                      const isContainerCurrent = c.id === item?.containerId;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.moveOption,
                            !isCurrentSpace && styles.moveOptionIndented,
                            isContainerCurrent && styles.moveOptionDisabled,
                            { borderColor },
                          ]}
                          onPress={isContainerCurrent ? undefined : () => handleMoveToContainer(s.id, c.id)}
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
                <TouchableOpacity style={[styles.moveCancelBtn, { borderColor }]} onPress={() => setShowMoveModal(false)}>
                  <Text style={[styles.moveCancelText, { color: subtleText }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <PhotoPickerSheet
        visible={showPhotoPicker}
        onClose={() => setShowPhotoPicker(false)}
        onCamera={() => handleAddPhoto('camera')}
        onGallery={() => handleAddPhoto('gallery')}
      />
      <PhotoActionSheet
        visible={showPhotoActions}
        title={item.name}
        onView={() => setShowPhotoViewer(true)}
        onReplace={() => setShowPhotoPicker(true)}
        onRemove={handleRemovePhoto}
        onClose={() => setShowPhotoActions(false)}
      />
      <PhotoViewModal
        visible={showPhotoViewer}
        uri={item.photoUri ?? null}
        title={item.name}
        onClose={() => setShowPhotoViewer(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 16, fontWeight: '500' },

  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, paddingVertical: 8 },
  backBtn: { paddingRight: 12, paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },

  content: { paddingHorizontal: 16, paddingTop: 16 },

  menuBtn: { paddingLeft: 12, paddingVertical: 8 },
  menuSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  menuTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  menuItemText: { fontSize: 15, fontWeight: '500' },

  lendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  lendingBannerText: { fontSize: 14, fontWeight: '500' },
  foundBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  foundBtnText: { color: '#d32f2f', fontSize: 12, fontWeight: '700' },

  photoCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  photoFull: {
    width: '100%',
    height: 220,
  },
  addPhotoBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  addPhotoText: { fontSize: 15, fontWeight: '500' },
  fieldCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 4 },
  fieldValue: { fontSize: 16, fontWeight: '500' },
  locationTrail: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 4 },
  locationPill: { minHeight: 30, maxWidth: '100%', borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationPillText: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  locationSeparator: { fontSize: 13, fontWeight: '800' },
  stockHint: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  stepperButton: { width: 38, height: 38, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepperValueWrap: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontSize: 18, fontWeight: '800' },
  stepperInput: { width: '100%', height: 38, textAlign: 'center', fontSize: 18, fontWeight: '800', paddingVertical: 0 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  presetChip: { minWidth: 44, minHeight: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  presetChipText: { fontSize: 13, fontWeight: '800' },
  protectedValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  protectedValueBox: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  secondaryMiniBtn: { minHeight: 38, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryMiniBtnText: { fontSize: 14, fontWeight: '800' },
  editActionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  enableContentsBtn: { borderRadius: 10, borderWidth: 1.5, padding: 12, marginTop: 4 },
  enableContentsText: { fontSize: 15, fontWeight: '800' },

  editRow: { gap: 8 },
  editInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  editInputMultiline: { minHeight: 80 },
  saveBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelText: { fontSize: 14, marginTop: 4 },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  moveSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '70%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  moveSheetTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 16 },
  moveOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6, gap: 12 },
  moveOptionDisabled: { opacity: 0.6 },
  moveOptionIndented: { marginLeft: 24 },
  moveOptionText: { fontSize: 15, fontWeight: '500' },
  moveSectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  currentBadgeText: { fontSize: 11, fontWeight: '600' },
  moveCancelBtn: { marginTop: 12, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  moveCancelText: { fontSize: 15, fontWeight: '600' },

  warrantyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  warrantyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  warrantyBadgeText: { fontSize: 11, fontWeight: '600' },
  warrantyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  warrantyEditBtn: { paddingVertical: 2 },
  warrantyEditText: { fontSize: 14, fontWeight: '600' },
});

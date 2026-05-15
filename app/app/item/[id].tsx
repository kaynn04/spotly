/**
 * ItemDetailScreen
 *
 * View and manage a single item — shows full info, edit fields, and actions (Move, Lend, Delete)
 * Accessed via /item/[id] dynamic route
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import PhotoPickerSheet from '@/components/PhotoPickerSheet';
import { Lending } from '@/src/features/lending/models/Lending';
import LendingFormModal from '@/src/features/lending/screens/components/LendingFormModal';
import { OutsideService } from '@/src/features/outside/services/OutsideService';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBox, faHandshake, faCheck, faTrash, faMapPin, faFolder, faEllipsisVertical, faChevronLeft, faShield } from '@fortawesome/free-solid-svg-icons';
import DatePickerSheet from '@/src/features/lending/screens/components/DatePickerSheet';
import { parseDateOnly, startOfLocalDay } from '@/src/utils/dateOnly';

const PRIMARY = '#6b7f99';
const LENDING = '#9b72cb';
const WARRANTY = '#e09b3a';

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
  const [editingField, setEditingField] = useState<'name' | 'description' | 'quantity' | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editQuantity, setEditQuantity] = useState('');

  // Lending state
  const [activeLending, setActiveLending] = useState<Lending | null>(null);
  const [showLendModal, setShowLendModal] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const [lendNote, setLendNote] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [lendLoading, setLendLoading] = useState(false);

  // Menu state
  const [showMenu, setShowMenu] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

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

  async function handleSaveField(field: 'name' | 'description' | 'quantity') {
    if (!item) return;
    try {
      const updates: any = {};
      if (field === 'name') {
        if (!editName.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
        updates.name = editName.trim();
      } else if (field === 'description') {
        updates.description = editDescription.trim() || null;
      } else if (field === 'quantity') {
        updates.quantity = Math.max(1, parseInt(editQuantity) || 1);
      }
      await ItemService.updateItem(item.id, updates);
      setEditingField(null);
      await loadItem();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update');
    }
  }

  function startEdit(field: 'name' | 'description' | 'quantity') {
    if (!item) return;
    if (field === 'name') setEditName(item.name);
    else if (field === 'description') setEditDescription(item.description ?? '');
    else if (field === 'quantity') setEditQuantity(String(item.quantity));
    setEditingField(field);
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
    setLendLoading(true);
    try {
      await lendingService.createLending({
        item_id: item.id,
        borrower_name: borrowerName.trim(),
        note: lendNote.trim() || undefined,
      });
      setShowLendModal(false);
      setBorrowerName('');
      setLendNote('');
      await loadItem();
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
            onPress={() => {
              Alert.alert('Item Photo', '', [
                { text: 'Replace Photo', onPress: () => setShowPhotoPicker(true) },
                { text: 'Remove Photo', style: 'destructive', onPress: () => handleRemovePhoto() },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
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
          <Text style={[styles.fieldLabel, { color: subtleText }]}>Quantity</Text>
          {editingField === 'quantity' ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, { color: colors.text, backgroundColor: inputBg, borderColor, width: 80 }]}
                value={editQuantity}
                onChangeText={(t) => setEditQuantity(t.replace(/[^0-9]/g, ''))}
                autoFocus
                keyboardType="number-pad"
                maxLength={4}
              />
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: PRIMARY }]} onPress={() => handleSaveField('quantity')}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingField(null)}>
                <Text style={[styles.cancelText, { color: subtleText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => startEdit('quantity')}>
              <Text style={[styles.fieldValue, { color: colors.text }]}>{item.quantity}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Location */}
        <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.fieldLabel, { color: subtleText }]}>Location</Text>
          <Text style={[styles.fieldValue, { color: colors.text }]}>{locationText}</Text>
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
          textColor={colors.text}
          subtleText={subtleText}
          cardBg={cardBg}
          borderColor={borderColor}
          isDark={isDark}
        />

      </ScrollView>

      {/* Action Menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuDropdown, { backgroundColor: cardBg, borderColor, top: insets.top + 44 }]}>  
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: borderColor, borderBottomWidth: 1 }]}
              onPress={() => { setShowMenu(false); if (isOutside) { outsideGuard(); } else if (isLent) { lendingGuard(); } else { openMoveModal(); } }}
            >
              <FontAwesomeIcon icon={faBox} size={18} color={isOutside ? '#e67e22' : isLent ? '#e67e22' : PRIMARY} />
              <Text style={[styles.menuItemText, { color: isOutside ? '#e67e22' : isLent ? '#e67e22' : colors.text }]}>Move to...</Text>
            </TouchableOpacity>
            {isLent ? (
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: borderColor, borderBottomWidth: 1 }]} onPress={() => { setShowMenu(false); handleMarkReturned(); }}>
                <FontAwesomeIcon icon={faCheck} size={18} color={PRIMARY} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>Mark as returned</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: borderColor, borderBottomWidth: 1 }]}
              onPress={() => { setShowMenu(false); if (isOutside) { outsideGuard(); } else { setBorrowerName(''); setLendNote(''); setDueDate(null); setShowLendModal(true); } }}
              >
                <FontAwesomeIcon icon={faHandshake} size={18} color={isOutside ? '#e67e22' : PRIMARY} />
                <Text style={[styles.menuItemText, { color: isOutside ? '#e67e22' : colors.text }]}>Lend item</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handleDelete(); }}>
              <FontAwesomeIcon icon={faTrash} size={18} color="#e53e3e" />
              <Text style={[styles.menuItemText, { color: '#e53e3e' }]}>Delete item</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Lend Modal */}
      <LendingFormModal
        visible={showLendModal}
        item={item}
        borrowerName={borrowerName}
        onBorrowerNameChange={setBorrowerName}
        note={lendNote}
        onNoteChange={setLendNote}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        onSubmit={handleLendSubmit}
        onCancel={() => { setShowLendModal(false); setBorrowerName(''); setLendNote(''); setDueDate(null); }}
        loading={lendLoading}
      />

      {/* Move Modal */}
      <Modal visible={showMoveModal} transparent animationType="slide" onRequestClose={() => setShowMoveModal(false)}>
        <View style={styles.sheetOverlay}>
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
        </View>
      </Modal>

      <PhotoPickerSheet
        visible={showPhotoPicker}
        onClose={() => setShowPhotoPicker(false)}
        onCamera={() => handleAddPhoto('camera')}
        onGallery={() => handleAddPhoto('gallery')}
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
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  menuDropdown: { position: 'absolute', right: 16, borderRadius: 12, borderWidth: 1, minWidth: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
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

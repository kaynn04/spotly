/**
 * SpaceDetailScreen
 *
 * View and manage a single space -- minimalist redesign uniform with Outside feature
 * Accessed via /space/[id] dynamic route
 *
 * Design changes vs original:
 *  - No 3-dot menu: "Delete" shown directly in header
 *  - No FAB popup: explicit two-button bottom action bar
 *  - No inline item dropdowns: tapping item row opens native ActionSheet (Alert)
 *  - All modals replaced with bottom sheets
 *  - Full dark mode support
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMagnifyingGlass, faTimes, faChevronRight, faFolder, faChevronLeft, faEllipsisVertical, faBox, faHandshake, faCheck, faTrash, faMapPin } from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { Space } from '@/src/models/Space';
import type { Item } from '@/src/models/Item';
import type { Container } from '@/src/models/Container';
import { SpaceService } from '@/src/services/SpaceService';
import { ItemService } from '@/src/services/ItemService';
import { ContainerService } from '@/src/services/ContainerService';
import { ContainerRepository } from '@/src/repositories/ContainerRepository';
import { LendingService } from '@/src/features/lending/services/LendingService';
import { LendingRepository } from '@/src/features/lending/repositories/LendingRepository';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { PhotoService } from '@/src/services/PhotoService';
import { SpaceRepository } from '@/src/repositories/SpaceRepository';
import PhotoPickerSheet from '@/components/PhotoPickerSheet';
import { Lending } from '@/src/features/lending/models/Lending';
import { OutsideService } from '@/src/features/outside/services/OutsideService';
import ItemFormModal from '@/src/features/spaces/screens/components/ItemFormModal';
import ContainerFormModal from '@/src/features/spaces/screens/components/ContainerFormModal';
import LendingFormModal from '@/src/features/lending/screens/components/LendingFormModal';
import ItemActionSheet from '@/src/features/spaces/screens/components/ItemActionSheet';

const PRIMARY = '#6b7f99';
const LENDING = '#9b72cb';

type ListEntry =
  | { type: 'container'; data: Container }
  | { type: 'item'; data: Item };

export default function SpaceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const [space, setSpace] = useState<Space | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddContainerModal, setShowAddContainerModal] = useState(false);
  const [showSpacePhotoPicker, setShowSpacePhotoPicker] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedMoveItemId, setSelectedMoveItemId] = useState<string | null>(null);
  const [spaceContainers, setSpaceContainers] = useState<Record<string, Container[]>>({});

  const [showLendModal, setShowLendModal] = useState(false);
  const [selectedLendItem, setSelectedLendItem] = useState<Item | null>(null);
  const [borrowerName, setBorrowerName] = useState('');
  const [lendNote, setLendNote] = useState('');
  const [lendLoading, setLendLoading] = useState(false);

  const [actionSheetItem, setActionSheetItem] = useState<Item | null>(null);
  const [actionSheetContainer, setActionSheetContainer] = useState<Container | null>(null);
  const [showMoveContainerModal, setShowMoveContainerModal] = useState(false);
  const [selectedMoveContainer, setSelectedMoveContainer] = useState<Container | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterSegment, setFilterSegment] = useState<'all' | 'containers' | 'items' | 'lent'>('all');
  // Map of item_id → active Lending (null = not lent)
  const [activeLendingMap, setActiveLendingMap] = useState<Record<string, Lending>>({});
  // Set of item IDs currently in an active outside session
  const [activeOutsideItemIds, setActiveOutsideItemIds] = useState<Set<string>>(new Set());

  const lendingService = useMemo(
    () => new LendingService(new LendingRepository(), new ItemRepository()),
    []
  );
  const outsideService = useMemo(() => new OutsideService(), []);

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  useEffect(() => { loadAll(); }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (id) { loadItems(); loadContainers(); loadActiveLendings(); loadActiveOutsideItems(); }
    }, [id])
  );

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    try {
      setSpace(await SpaceService.getSpaceById(id));
      await Promise.all([loadItems(), loadContainers(), loadAllSpaces(), loadActiveLendings(), loadActiveOutsideItems()]);
    } catch (err) {
      console.error('[SpaceDetailScreen] loadAll:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSpace() {
    if (!id) return;
    setSpace(await SpaceService.getSpaceById(id));
  }

  async function loadItems() {
    if (!id) return;
    try { setItems(await ItemService.getItemsBySpaceId(id)); } catch {}
  }

  async function loadContainers() {
    if (!id) return;
    try { setContainers(await ContainerService.getContainersBySpaceId(id)); } catch {}
  }

  async function loadAllSpaces() {
    try { setAllSpaces(await SpaceService.getAllSpaces()); } catch {}
  }

  async function loadActiveLendings() {
    try {
      const active = await lendingService.getActiveLendings();
      const map: Record<string, Lending> = {};
      active.forEach((l) => { map[l.item_id] = l; });
      setActiveLendingMap(map);
    } catch {}
  }

  async function loadActiveOutsideItems() {
    try {
      const ids = await outsideService.getActiveSessionItemIds();
      setActiveOutsideItemIds(ids);
    } catch {}
  }

  async function handleMarkReturned(lendingId: string, item?: Item | null) {
    try {
      await lendingService.markAsReturned(lendingId);
      await loadActiveLendings();
      if (item) {
        const containerName = item.containerId
          ? containers.find((c) => c.id === item.containerId)?.name
          : null;
        const locationHint = containerName
          ? `It belongs in the "${containerName}" container.`
          : `It lives in the "${space?.name ?? 'current'}" space.`;
        Alert.alert('Returned ✓', `${item.name} has been marked as returned.\n\n${locationHint}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to mark as returned');
    }
  }

  function handleItemPress(item: Item) {
    setActionSheetItem(item);
  }

  function handleContainerLongPress(container: Container) {
    setActionSheetContainer(container);
  }

  function confirmDeleteContainer(container: Container) {
    const itemCount = items.filter((i) => i.containerId === container.id).length;
    const msg = itemCount > 0
      ? `Delete "${container.name}" and its ${itemCount} item${itemCount !== 1 ? 's' : ''}? This cannot be undone.`
      : `Delete "${container.name}"? This cannot be undone.`;
    Alert.alert('Delete Container', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await ContainerService.deleteContainer(container.id);
            await loadContainers();
            await loadItems();
          } catch {
            Alert.alert('Error', 'Failed to delete container');
          }
        },
      },
    ]);
  }

  async function handleMoveContainerToSpace(targetSpaceId: string) {
    if (!selectedMoveContainer) return;
    try {
      await ContainerService.moveContainer(selectedMoveContainer.id, targetSpaceId);
      setShowMoveContainerModal(false);
      setSelectedMoveContainer(null);
      await loadContainers();
      await loadItems();
    } catch {
      Alert.alert('Error', 'Failed to move container');
    }
  }

  function confirmDeleteItem(itemId: string, itemName: string) {
    Alert.alert('Delete Item', `Delete "${itemName}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await ItemService.deleteItem(itemId); await loadItems(); }
          catch { Alert.alert('Error', 'Failed to delete item'); }
        },
      },
    ]);
  }

  async function openMoveModalForItem(itemId: string) {
    setSelectedMoveItemId(itemId);
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

  async function handleMoveToContainer(targetSpaceId: string, containerId: string) {
    if (!selectedMoveItemId) return;
    try {
      await ItemService.moveItemToContainer(selectedMoveItemId, targetSpaceId, containerId);
      setShowMoveModal(false);
      setSelectedMoveItemId(null);
      await loadItems();
    } catch { Alert.alert('Error', 'Failed to move item'); }
  }

  async function handleMoveToSpace(targetSpaceId: string) {
    if (!selectedMoveItemId || !id) return;
    try {
      if (targetSpaceId === id) {
        await ItemService.moveItemToContainer(selectedMoveItemId, id, '');
      } else {
        await ItemService.moveItem(selectedMoveItemId, id, targetSpaceId);
      }
      setShowMoveModal(false);
      setSelectedMoveItemId(null);
      await loadItems();
    } catch { Alert.alert('Error', 'Failed to move item'); }
  }

  async function handleLendSubmit() {
    if (!borrowerName.trim() || !selectedLendItem) return;
    setLendLoading(true);
    try {
      await lendingService.createLending({
        item_id: selectedLendItem.id,
        borrower_name: borrowerName.trim(),
        note: lendNote.trim() || undefined,
      });
      setShowLendModal(false);
      setBorrowerName('');
      setLendNote('');
      setSelectedLendItem(null);
      // Refresh active lendings map to show "Lent" badge immediately
      await loadActiveLendings();
    } catch (err: any) {
      Alert.alert('Error', err.code === 'DUPLICATE_ACTIVE_LENDING'
        ? 'This item is already lent out'
        : err.message || 'Failed to lend item');
    } finally {
      setLendLoading(false);
    }
  }

  function handleDeleteSpace() {
    if (!space) return;
    Alert.alert('Delete Space', `Delete "${space.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await SpaceService.deleteSpace(id!); router.back(); }
          catch { Alert.alert('Error', 'Failed to delete space'); }
        },
      },
    ]);
  }

  async function handleAddItem(name: string, description?: string, quantity?: number, photoUri?: string | null) {
    // Create item first to get the ID, then save photo if provided
    const item = await ItemService.createItem(id!, name, null, description, quantity);
    if (photoUri) {
      const savedUri = await PhotoService.savePhoto(photoUri, item.id);
      await ItemRepository.updatePhotoUri(item.id, savedUri);
    }
    await loadItems();
  }

  async function handleAddContainer(name: string, photoUri?: string | null) {
    const container = await ContainerService.createContainer(name, id!);
    if (photoUri && container) {
      const savedUri = await PhotoService.savePhoto(photoUri, `container_${container.id}`);
      await ContainerRepository.updatePhotoUri(container.id, savedUri);
    }
    await loadContainers();
    await loadItems();
  }

  async function handleSpacePhoto(source: 'camera' | 'gallery') {
    if (!id) return;
    setShowSpacePhotoPicker(false);
    try {
      const tempUri = source === 'camera'
        ? await PhotoService.captureFromCamera()
        : await PhotoService.pickFromGallery();
      if (!tempUri) return;
      if (space?.photoUri) await PhotoService.deletePhoto(space.photoUri);
      const savedUri = await PhotoService.savePhoto(tempUri, `space_${id}`);
      await SpaceRepository.updatePhotoUri(id, savedUri);
      await loadSpace();
    } catch {
      Alert.alert('Error', 'Failed to save photo');
    }
  }

  async function handleRemoveSpacePhoto() {
    if (!id) return;
    try {
      if (space?.photoUri) await PhotoService.deletePhoto(space.photoUri);
      await SpaceRepository.updatePhotoUri(id, null);
      await loadSpace();
    } catch {
      Alert.alert('Error', 'Failed to remove photo');
    }
  }

  const spaceLevelItems = items.filter((item) => !item.containerId);
  
  // Filter logic: combine search + segment filter
  const searchLower = searchText.toLowerCase();
  const allEntries: ListEntry[] = [
    ...containers.map((c) => ({ type: 'container' as const, data: c })),
    ...spaceLevelItems.map((i) => ({ type: 'item' as const, data: i })),
  ];
  
  const filteredData = allEntries.filter((entry) => {
    // Apply segment filter
    if (filterSegment === 'containers' && entry.type !== 'container') return false;
    if (filterSegment === 'items' && entry.type !== 'item') return false;
    if (filterSegment === 'lent') {
      if (entry.type !== 'item') return false;
      if (!activeLendingMap[(entry.data as Item).id]) return false;
    }
    // Apply search filter
    if (searchText.trim()) {
      const name = entry.data.name.toLowerCase();
      return name.includes(searchLower);
    }
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: borderColor, paddingTop: insets.top, backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesomeIcon icon={faChevronLeft} size={16} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {space?.name ?? 'Space'}
        </Text>
        <TouchableOpacity onPress={handleDeleteSpace} style={styles.deleteBtn}>
          <Text style={[styles.deleteBtnText, { color: isDark ? '#ff453a' : '#d32f2f' }]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Space Photo */}
      {!loading && space && (
        space.photoUri ? (
          <TouchableOpacity
            style={[styles.spacePhotoWrap, { borderColor }]}
            onPress={() => Alert.alert('Space Photo', '', [
              { text: 'Replace Photo', onPress: () => setShowSpacePhotoPicker(true) },
              { text: 'Remove Photo', style: 'destructive', onPress: handleRemoveSpacePhoto },
              { text: 'Cancel', style: 'cancel' },
            ])}
            activeOpacity={0.8}
          >
            <Image source={{ uri: space.photoUri }} style={styles.spacePhoto} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.spacePhotoPlaceholder, { backgroundColor: cardBg, borderColor }]}
            onPress={() => setShowSpacePhotoPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.spacePhotoPlaceholderText, { color: subtleText }]}>+ Add Space Photo</Text>
          </TouchableOpacity>
        )
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <>
          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
            <View style={[styles.searchInputWrapper, { backgroundColor: isDark ? '#2c2c2e' : '#ffffff', borderColor }]}>
              <FontAwesomeIcon icon={faMagnifyingGlass} size={14} color={colors.text} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search containers & items..."
                placeholderTextColor={subtleText}
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearBtn}>
                  <FontAwesomeIcon icon={faTimes} size={13} color={isDark ? '#8e8e93' : '#8e8e93'} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Segment Control */}
          <View style={[styles.segmentContainer, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
            <View style={[styles.segmentTrack, { backgroundColor: isDark ? '#1c1c1e' : '#eef0f3' }]}>
              {(['all', 'containers', 'items', 'lent'] as const).map((segment) => {
                const isActive = filterSegment === segment;
                return (
                  <TouchableOpacity
                    key={segment}
                    style={[
                      styles.segmentBtn,
                      isActive && [styles.segmentBtnActive, { backgroundColor: isDark ? '#2c2c2e' : '#ffffff' }],
                    ]}
                    onPress={() => setFilterSegment(segment)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.segmentBtnText,
                      { color: isActive ? (isDark ? '#ffffff' : '#1c1c1e') : subtleText },
                    ]}>
                      {segment === 'all' ? 'All' : segment === 'containers' ? 'Containers' : segment === 'items' ? 'Items' : 'Lent'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* List */}
          <FlatList
            data={filteredData}
            keyExtractor={(entry) =>
              entry.type === 'container' ? `c-${entry.data.id}` : `i-${entry.data.id}`
            }
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              filteredData.length > 0 ? (
                <Text style={[styles.sectionLabel, { color: subtleText }]}>
                  {filterSegment === 'all'
                    ? `${filteredData.filter(e => e.type === 'container').length} container${filteredData.filter(e => e.type === 'container').length !== 1 ? 's' : ''} \u00B7 ${filteredData.filter(e => e.type === 'item').length} item${filteredData.filter(e => e.type === 'item').length !== 1 ? 's' : ''} \u00B7 Hold to manage`
                    : filterSegment === 'containers'
                    ? `${filteredData.length} container${filteredData.length !== 1 ? 's' : ''} \u00B7 Hold to manage`
                    : filterSegment === 'items'
                    ? `${filteredData.length} item${filteredData.length !== 1 ? 's' : ''} \u00B7 Hold to manage`
                    : `${filteredData.length} lent item${filteredData.length !== 1 ? 's' : ''}`}
                </Text>
              ) : null
            }
            renderItem={({ item: entry }) => {
              if (entry.type === 'container') {
                const c = entry.data;
                const count = items.filter((i) => i.containerId === c.id).length;
              return (
                <TouchableOpacity
                  style={[styles.containerCard, { backgroundColor: cardBg, borderColor }]}
                  onPress={() => router.push({ pathname: '../container/[id]' as any, params: { id: c.id } })}
                  onLongPress={() => handleContainerLongPress(c)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.containerIcon, { backgroundColor: `${PRIMARY}15` }]}>
                    {c.photoUri
                      ? <Image source={{ uri: c.photoUri }} style={styles.containerThumb} />
                      : <FontAwesomeIcon icon={faFolder} size={16} color={PRIMARY} />
                    }
                  </View>
                  <View style={styles.containerContent}>
                    <Text style={[styles.containerName, { color: colors.text }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={[styles.containerMeta, { color: subtleText }]}>
                      {count} {count === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  <FontAwesomeIcon icon={faChevronRight} size={16} color={subtleText} />
                </TouchableOpacity>
              );
            }
            const item = entry.data;
            const activeLending = activeLendingMap[item.id];
            const isLent = !!activeLending;
            const isOutside = activeOutsideItemIds.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: cardBg, borderColor: isOutside ? '#e67e2240' : isLent ? `${LENDING}40` : borderColor }]}
                onPress={() => router.push({ pathname: '../item/[id]' as any, params: { id: item.id } })}
                onLongPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.itemDot, { backgroundColor: isOutside ? '#e67e22' : isLent ? LENDING : isDark ? '#48484a' : '#c7c7cc' }]} />
                {item.photoUri ? (
                  <Image source={{ uri: item.photoUri }} style={styles.itemThumb} />
                ) : null}
                <View style={styles.itemTextWrap}>
                  <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  {isLent && (
                    <Text style={[styles.itemLentMeta, { color: LENDING }]} numberOfLines={1}>
                      Lent to {activeLending.borrower_name}
                    </Text>
                  )}
                  {isOutside && !isLent && (
                    <Text style={[styles.itemLentMeta, { color: '#e67e22' }]} numberOfLines={1}>
                      In outside session
                    </Text>
                  )}
                </View>
                {isOutside && (
                  <View style={[styles.lentBadge, { backgroundColor: '#e67e2215' }]}>
                    <Text style={[styles.lentBadgeText, { color: '#e67e22' }]}>Outside</Text>
                  </View>
                )}
                {!isOutside && isLent && (
                  <View style={[styles.lentBadge, { backgroundColor: `${LENDING}15` }]}>
                    <Text style={[styles.lentBadgeText, { color: LENDING }]}>Lent</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.emptyText, { color: subtleText }]}>
                {searchText ? (
                  'No results found'
                ) : filterSegment === 'containers' ? (
                  'No containers yet'
                ) : filterSegment === 'items' ? (
                  'No items yet'
                ) : filterSegment === 'lent' ? (
                  'No items are currently lent out'
                ) : (
                  'No items or containers yet.\nUse the buttons below to get started.'
                )}
              </Text>
            </View>
          }
        />
        </>
      )}

      {/* Bottom Action Bar */}
      <View style={[styles.actionBar, { backgroundColor: cardBg, borderTopColor: borderColor, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[styles.actionBarBtn, styles.actionBarBtnOutline, { borderColor: PRIMARY }]}
          onPress={() => setShowAddContainerModal(true)}
        >
          <Text style={[styles.actionBarBtnText, { color: PRIMARY }]}>+ Container</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBarBtn, { backgroundColor: PRIMARY }]}
          onPress={() => setShowAddItemModal(true)}
        >
          <Text style={[styles.actionBarBtnText, { color: '#fff' }]}>+ Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Move Bottom Sheet */}
      <Modal visible={showMoveModal} transparent animationType="slide" onRequestClose={() => setShowMoveModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.moveSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
            <Text style={[styles.moveSheetTitle, { color: colors.text }]}>Move Item</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {allSpaces.map((s) => {
                const movingItem = items.find(i => i.id === selectedMoveItemId);
                const isCurrentSpace = s.id === id;
                const spaceContainerList = spaceContainers[s.id] ?? [];
                const isRootCurrent = isCurrentSpace && !movingItem?.containerId;
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
                    {spaceContainerList.map((c) => {
                      const isContainerCurrent = c.id === movingItem?.containerId;
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

      <ItemFormModal visible={showAddItemModal} onClose={() => setShowAddItemModal(false)} onSubmit={handleAddItem} contextLabel={space?.name} />
      <ContainerFormModal visible={showAddContainerModal} onClose={() => setShowAddContainerModal(false)} onSubmit={handleAddContainer} />
      <LendingFormModal
        visible={showLendModal}
        item={selectedLendItem}
        borrowerName={borrowerName}
        onBorrowerNameChange={setBorrowerName}
        note={lendNote}
        onNoteChange={setLendNote}
        onSubmit={handleLendSubmit}
        onCancel={() => { setShowLendModal(false); setBorrowerName(''); setLendNote(''); setSelectedLendItem(null); }}
        loading={lendLoading}
      />
      <ItemActionSheet
        visible={actionSheetItem !== null}
        itemName={actionSheetItem?.name ?? ''}
        activeLending={actionSheetItem ? (activeLendingMap[actionSheetItem.id] ?? null) : null}
        activeOutsideSession={actionSheetItem ? activeOutsideItemIds.has(actionSheetItem.id) : false}
        onClose={() => setActionSheetItem(null)}
        actions={(() => {
          const item = actionSheetItem;
          if (!item) return [];
          const lending = activeLendingMap[item.id];
          const isLent = !!lending;
          const isOutside = activeOutsideItemIds.has(item.id);
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
          return [
            {
              icon: faBox,
              label: 'Move',
              description: isOutside ? 'In active outside session' : isLent ? 'Item is currently lent out' : 'Move to another space or container',
              onPress: isOutside ? outsideGuard : isLent ? lendingGuard : () => openMoveModalForItem(item.id),
            },
            isLent
              ? {
                  icon: faCheck,
                  label: 'Mark as Returned',
                  description: `${lending.borrower_name} returned this item`,
                  onPress: () => handleMarkReturned(lending.id, item),
                }
              : {
                  icon: faHandshake,
                  label: 'Lend',
                  description: isOutside ? 'In active outside session' : 'Track who you lent this item to',
                  onPress: isOutside ? outsideGuard : () => { setSelectedLendItem(item); setBorrowerName(''); setLendNote(''); setShowLendModal(true); },
                },
            {
              icon: faTrash,
              label: 'Delete',
              description: isLent ? 'Item is currently lent out' : isOutside ? 'In active outside session' : 'Permanently remove this item',
              destructive: true,
              onPress: () => confirmDeleteItem(item.id, item.name),
            },
          ];
        })()}
      />
      <ItemActionSheet
        visible={actionSheetContainer !== null}
        itemName={actionSheetContainer?.name ?? ''}
        onClose={() => setActionSheetContainer(null)}
        actions={(() => {
          const c = actionSheetContainer;
          if (!c) return [];
          const itemCount = items.filter((i) => i.containerId === c.id).length;
          return [
            {
              icon: faBox,
              label: 'Move',
              description: 'Move container to another space',
              onPress: () => { setSelectedMoveContainer(c); setShowMoveContainerModal(true); },
            },
            {
              icon: faTrash,
              label: 'Delete',
              description: itemCount > 0 ? `Will delete ${itemCount} item${itemCount !== 1 ? 's' : ''} inside` : 'Remove this empty container',
              destructive: true,
              onPress: () => confirmDeleteContainer(c),
            },
          ];
        })()}
      />
      {/* Move Container Modal */}
      <Modal visible={showMoveContainerModal} transparent animationType="slide" onRequestClose={() => setShowMoveContainerModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.moveSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
            <Text style={[styles.moveSheetTitle, { color: colors.text }]}>Move Container</Text>
            <Text style={[styles.moveSheetSubtitle, { color: subtleText }]}>
              Move "{selectedMoveContainer?.name}" to another space
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {allSpaces.filter((s) => s.id !== id).map((s) => (
                <TouchableOpacity key={s.id} style={[styles.moveOption, { borderColor }]} onPress={() => handleMoveContainerToSpace(s.id)}>
                  <Text style={styles.moveOptionIcon}>{'\u{1F4CD}'}</Text>
                  <Text style={[styles.moveOptionText, { color: colors.text }]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
              {allSpaces.filter((s) => s.id !== id).length === 0 && (
                <Text style={[styles.moveEmptyText, { color: subtleText }]}>No other spaces available</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.moveCancelBtn, { borderColor }]} onPress={() => setShowMoveContainerModal(false)}>
              <Text style={[styles.moveCancelText, { color: subtleText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PhotoPickerSheet
        visible={showSpacePhotoPicker}
        onClose={() => setShowSpacePhotoPicker(false)}
        onCamera={() => handleSpacePhoto('camera')}
        onGallery={() => handleSpacePhoto('gallery')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { paddingRight: 12, paddingVertical: 8 },
  backBtnText: { fontSize: 16, fontWeight: '500' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  deleteBtn: { paddingLeft: 12, paddingVertical: 8 },
  spacePhotoWrap: { marginHorizontal: 16, marginTop: 8, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  spacePhoto: { width: '100%', height: 160 },
  spacePhotoPlaceholder: { marginHorizontal: 16, marginTop: 8, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', paddingVertical: 14, alignItems: 'center' },
  spacePhotoPlaceholderText: { fontSize: 14, fontWeight: '500' },
  deleteBtnText: { fontSize: 15, color: '#d32f2f', fontWeight: '500' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 12 },
  containerCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8, gap: 12 },
  containerThumb: { width: 36, height: 36, borderRadius: 6 },
  containerIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  containerIconText: { fontSize: 18 },
  containerContent: { flex: 1 },
  containerName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  containerMeta: { fontSize: 12 },
  chevron: { fontSize: 16 },
  itemCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 6, gap: 10 },
  itemDot: { width: 6, height: 6, borderRadius: 3 },
  itemThumb: { width: 40, height: 40, borderRadius: 8 },
  itemTextWrap: { flex: 1, gap: 2 },
  itemName: { fontSize: 15, fontWeight: '500' },
  itemLentMeta: { fontSize: 11, fontWeight: '500' },
  itemMoreDots: { fontSize: 14, letterSpacing: 1 },
  lentBadge: { borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  lentBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 28, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  actionBarBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  actionBarBtnOutline: { borderWidth: 1.5 },
  actionBarBtnText: { fontSize: 15, fontWeight: '600' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  moveSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '70%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  moveSheetTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 },
  moveSheetSubtitle: { fontSize: 14, marginBottom: 16 },
  moveEmptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  moveSectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  moveOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6, gap: 12 },
  moveOptionDisabled: { opacity: 0.6 },
  moveOptionIndented: { marginLeft: 24 },
  moveOptionIcon: { fontSize: 16 },
  moveOptionText: { fontSize: 15, fontWeight: '500', flex: 1 },
  currentLocationSection: { marginBottom: 4 },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  currentBadgeText: { fontSize: 11, fontWeight: '600' },
  moveCancelBtn: { marginTop: 12, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  moveCancelText: { fontSize: 15, fontWeight: '600' },
  
  // Search & Filter
  searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 40 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  clearBtn: { padding: 4 },
  clearBtnText: { fontSize: 18, fontWeight: '300' },
  
  segmentContainer: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  segmentTrack: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 2 },
  segmentBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentBtnActive: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  segmentBtnText: { fontSize: 13, fontWeight: '600' },
  
  emptyStateContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { fontSize: 14, textAlign: 'center' },
});
/**
 * ContainerDetailScreen
 *
 * View and manage items inside a container -- minimalist redesign uniform with Outside feature
 * Accessed via /container/[id] dynamic route
 *
 * Design changes vs original:
 *  - No 3-dot menu per item: tapping item row opens native ActionSheet (Alert)
 *  - No FAB popup: single "+ Add Item" bottom action bar button
 *  - Move modal replaced with bottom sheet
 *  - Full dark mode support
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Modal,
  Image,
  TouchableWithoutFeedback,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft, faMapPin, faBox, faHandshake, faCheck, faTrash, faFolder, faRightLeft, faArrowDownAZ, faArrowDownZA, faCalendarPlus, faCalendar, faFilter, faList, faGrip, faPen, faTimes, faEllipsisVertical, faMagnifyingGlass, faQrcode } from '@fortawesome/free-solid-svg-icons';
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
import { LendingService } from '@/src/features/lending/services/LendingService';
import { LendingRepository } from '@/src/features/lending/repositories/LendingRepository';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { PhotoService } from '@/src/services/PhotoService';
import { ContainerRepository } from '@/src/repositories/ContainerRepository';
import PhotoActionSheet from '@/components/PhotoActionSheet';
import PhotoPickerSheet from '@/components/PhotoPickerSheet';
import PhotoViewModal from '@/components/PhotoViewModal';
import { Lending } from '@/src/features/lending/models/Lending';
import { OutsideService } from '@/src/features/outside/services/OutsideService';
import ItemFormModal from '@/src/features/spaces/screens/components/ItemFormModal';
import ItemActionSheet from '@/src/features/spaces/screens/components/ItemActionSheet';
import LendingFormModal from '@/src/features/lending/screens/components/LendingFormModal';
import ContainerFormModal from '@/src/features/spaces/screens/components/ContainerFormModal';
import { BarcodeScannerService, type ScannedBarcode } from '@/src/features/tools/services/BarcodeScannerService';

const PRIMARY = '#6b7f99';
const LENDING = '#9b72cb';
const CONTAINER_SORT_KEY = 'synop:container-detail-sort';
const CONTAINER_VIEW_KEY = 'synop:container-detail-view';
type SortMode = 'name-asc' | 'name-desc' | 'newest' | 'oldest';
type ViewMode = 'list' | 'grid';
const GRID_GAP = 10;
const GRID_PADDING = 16;
const GRID_COLUMNS = 2;

export default function ContainerDetailScreen() {
  const router = useRouter();
  const { id: containerId, openAddItem } = useLocalSearchParams<{ id: string; openAddItem?: string }>();
  const openAddItemOnce = useRef(openAddItem === '1');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const { width: screenWidth } = useWindowDimensions();
  const GRID_ITEM_WIDTH = (screenWidth - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const [container, setContainer] = useState<Container | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showContainerPhotoActions, setShowContainerPhotoActions] = useState(false);
  const [showContainerPhotoPicker, setShowContainerPhotoPicker] = useState(false);
  const [showContainerPhotoViewer, setShowContainerPhotoViewer] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedMoveItemIds, setSelectedMoveItemIds] = useState<Set<string>>(new Set());
  const [actionSheetItem, setActionSheetItem] = useState<Item | null>(null);
  const [showContainerMenu, setShowContainerMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showMoveContainerModal, setShowMoveContainerModal] = useState(false);
  const [spaceContainers, setSpaceContainers] = useState<Record<string, Container[]>>({});
  const [sortMode, setSortMode] = useState<SortMode>('name-asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchText, setSearchText] = useState('');

  // Select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectModeRef = useRef(false);
  selectModeRef.current = selectMode;
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Lending state
  const [showLendModal, setShowLendModal] = useState(false);
  const [selectedLendItem, setSelectedLendItem] = useState<Item | null>(null);
  const [borrowerName, setBorrowerName] = useState('');
  const [lendQuantity, setLendQuantity] = useState('1');
  const [lendNote, setLendNote] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [lendLoading, setLendLoading] = useState(false);
  const [lendBeforePhotoUris, setLendBeforePhotoUris] = useState<string[]>([]);
  const [activeLendingMap, setActiveLendingMap] = useState<Record<string, Lending>>({});
  const [activeOutsideItemIds, setActiveOutsideItemIds] = useState<Set<string>>(new Set());

  const lendingService = useMemo(
    () => new LendingService(new LendingRepository(), new ItemRepository()),
    []
  );
  const outsideService = useMemo(() => new OutsideService(), []);

  // Load persisted preferences
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CONTAINER_SORT_KEY),
      AsyncStorage.getItem(CONTAINER_VIEW_KEY),
    ]).then(([s, v]) => {
      if (s === 'name-asc' || s === 'name-desc' || s === 'newest' || s === 'oldest') setSortMode(s);
      if (v === 'list' || v === 'grid') setViewMode(v);
    }).catch(() => {});
  }, []);

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  useEffect(() => { loadContainer(); }, [containerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open add item modal when navigated here via the + button
  useEffect(() => {
    if (!loading && openAddItemOnce.current) {
      openAddItemOnce.current = false;
      setShowAddItemModal(true);
    }
  }, [loading]);

  useFocusEffect(
    useCallback(() => {
      if (container?.id) { loadItems(); loadAllSpaces(); loadActiveLendings(); loadActiveOutsideItems(); }
    }, [container?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function loadContainer() {
    if (!containerId) return;
    setLoading(true);
    try {
      const result = await ContainerService.getContainerById(containerId);
      setContainer(result);
      if (result?.spaceId) {
        const spaceResult = await SpaceService.getSpaceById(result.spaceId);
        setSpace(spaceResult);
      }
      await Promise.all([loadItems(), loadAllSpaces()]);
    } catch (err) {
      console.error('[ContainerDetailScreen] loadContainer:', err);
      Alert.alert('Error', 'Failed to load container');
    } finally {
      setLoading(false);
    }
  }

  async function loadItems() {
    if (!containerId) return;
    try { setItems(await ItemService.getItemsByContainerId(containerId)); } catch {}
  }

  async function loadAllSpaces() {
    try {
      const spaces = await SpaceService.getAllSpaces();
      setAllSpaces(spaces);
      const entries = await Promise.all(
        spaces.map(async (s) => {
          const cs = await ContainerService.getContainersBySpaceId(String(s.id));
          return [String(s.id), cs] as [string, Container[]];
        })
      );
      setSpaceContainers(Object.fromEntries(entries));
    } catch {}
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
        Alert.alert('Returned ✓', `${item.name} has been marked as returned.\n\nIt belongs in the "${container?.name ?? 'current'}" container.`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to mark as returned');
    }
  }

  async function handleLendSubmit() {
    if (!borrowerName.trim() || !selectedLendItem) return;
    const quantity = Math.max(1, Math.floor(Number(lendQuantity) || 1));
    setLendLoading(true);
    try {
      const lending = await lendingService.createLending({
        item_id: selectedLendItem.id,
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
      setSelectedLendItem(null);
      await loadActiveLendings();
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

  function handleContainerMenuPress() {
    setShowContainerMenu(true);
  }

  const switchSortMode = (mode: SortMode) => {
    setSortMode(mode);
    AsyncStorage.setItem(CONTAINER_SORT_KEY, mode).catch(() => {});
    setShowSortMenu(false);
  };

  const sortLabel =
    sortMode === 'name-asc' ? 'A-Z' :
    sortMode === 'name-desc' ? 'Z-A' :
    sortMode === 'newest' ? 'Newest' :
    'Oldest';

  const switchViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    AsyncStorage.setItem(CONTAINER_VIEW_KEY, mode).catch(() => {});
    setShowContainerMenu(false);
  };

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    switch (sortMode) {
      case 'name-asc': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'newest': sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
      case 'oldest': sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); break;
    }
    return sorted;
  }, [items, sortMode]);

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return sortedItems;
    return sortedItems.filter((item) =>
      item.name.toLowerCase().includes(query) ||
      (item.description ?? '').toLowerCase().includes(query)
    );
  }, [searchText, sortedItems]);

  // --- Select mode ---
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectModeRef.current) { exitSelectMode(); return true; }
      return false;
    });
    return () => sub.remove();
  }, []);

  const enterSelectMode = (item: Item) => {
    setSelectMode(true);
    setSelectedIds(new Set([item.id]));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredItems.map((i) => i.id)));
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    Alert.alert(
      `Delete ${count} Item${count !== 1 ? 's' : ''}`,
      `This will permanently delete ${count} item${count !== 1 ? 's' : ''}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await Promise.all([...selectedIds].map((iid) => ItemService.deleteItem(iid)));
            exitSelectMode();
            await loadItems();
          } catch { Alert.alert('Error', 'Some items could not be deleted'); }
        }},
      ]
    );
  };

  const handleBulkEdit = () => {
    if (selectedIds.size !== 1) return;
    const itemId = [...selectedIds][0];
    const item = items.find((i) => i.id === itemId);
    if (item) setEditingItem(item);
  };

  const handleBulkMove = () => {
    if (selectedIds.size === 0) return;
    
    // Check if any selected items are lent, outside, or lost
    const blockedItems = [...selectedIds].filter((itemId) => {
      const isOutside = activeOutsideItemIds.has(itemId);
      const isLent = !!activeLendingMap[itemId];
      const isLost = !!items.find((item) => item.id === itemId)?.lostAt;
      return isOutside || isLent || isLost;
    });
    
    if (blockedItems.length > 0) {
      const blockedNames = blockedItems
        .map((id) => items.find((i) => i.id === id)?.name ?? id)
        .join(', ');
      Alert.alert(
        'Items are Blocked',
        `Cannot move: ${blockedNames}. Complete outside sessions, mark lent items as returned, or mark lost items as found first.`
      );
      return;
    }
    
    exitSelectMode();
    setSelectedMoveItemIds(new Set(selectedIds));
    setShowMoveModal(true);
  };

  const handleBulkLend = () => {
    if (selectedIds.size !== 1) return;
    const itemId = [...selectedIds][0];
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const isOutside = activeOutsideItemIds.has(item.id);
    const isLent = !!activeLendingMap[item.id];
    const isLost = !!item.lostAt;
    if (isOutside) {
      Alert.alert('Item is Outside', 'Complete the outside session before lending.');
      return;
    }
    if (isLent) {
      Alert.alert('Already Lent', 'This item is already lent out.');
      return;
    }
    if (isLost) {
      Alert.alert('Item is Lost', 'Mark this item as found before lending it.');
      return;
    }
    exitSelectMode();
    setSelectedLendItem(item);
    setBorrowerName('');
    setLendQuantity('1');
    setLendNote('');
    setDueDate(null);
    setLendBeforePhotoUris([]);
    setShowLendModal(true);
  };

  const handleEditItemSubmit = async (name: string, description?: string, quantity?: number, photoUri?: string | null, warrantyExpiry?: Date | null, barcode?: ScannedBarcode | null, unitsPerPack?: number | null) => {
    if (!editingItem) return;
    await ItemService.updateItem(editingItem.id, { name, description: description ?? null, quantity: quantity ?? 0, unitsPerPack: unitsPerPack ?? null });
    if (photoUri && photoUri !== editingItem.photoUri) {
      const savedUri = await PhotoService.savePhoto(photoUri, editingItem.id);
      await ItemRepository.updatePhotoUri(editingItem.id, savedUri);
    } else if (!photoUri && editingItem.photoUri) {
      await PhotoService.deletePhoto(editingItem.photoUri);
      await ItemRepository.updatePhotoUri(editingItem.id, null);
    }
    setEditingItem(null);
    exitSelectMode();
    await loadItems();
  };

  const handleEditContainerSubmit = async (name: string, description?: string | null, photoUri?: string | null) => {
    if (!container) return;
    await ContainerService.updateContainer(container.id, { name, description: description ?? null });
    if (photoUri && photoUri !== container.photoUri) {
      const savedUri = await PhotoService.savePhoto(photoUri, `container_${container.id}`);
      await ContainerRepository.updatePhotoUri(container.id, savedUri);
    } else if (!photoUri && container.photoUri) {
      await PhotoService.deletePhoto(container.photoUri);
      await ContainerRepository.updatePhotoUri(container.id, null);
    }
    setEditingContainer(null);
    await loadContainer();
  };

  async function handleMoveContainerToSpace(targetSpaceId: string) {
    if (!containerId) return;
    
    // Check if any items in the container are lent or outside
    const blockedItems = items.filter((item) => {
      const isOutside = activeOutsideItemIds.has(item.id);
      const isLent = !!activeLendingMap[item.id];
      return isOutside || isLent;
    });
    
    if (blockedItems.length > 0) {
      const blockedNames = blockedItems.map((i) => i.name).join(', ');
      Alert.alert(
        'Items are Blocked',
        `Cannot move container: ${blockedNames} ${blockedItems.length === 1 ? 'is' : 'are'} lent or in an outside session. Complete these tasks first.`
      );
      return;
    }
    
    try {
      await ContainerService.moveContainer(containerId, targetSpaceId);
      setShowMoveContainerModal(false);
      router.back();
    } catch { Alert.alert('Error', 'Failed to move container'); }
  }

  function confirmDeleteContainer() {
    Alert.alert(
      'Delete Container',
      `Delete "${container?.name ?? 'this container'}" and all its items? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await ContainerService.deleteContainer(containerId!);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete container');
            }
          },
        },
      ]
    );
  }

  function openContainerPrintableLabel() {
    if (!container) return;
    setShowContainerMenu(false);
    router.push({
      pathname: '/tools/label-qr' as any,
      params: {
        targetKind: 'container',
        targetId: container.id,
      },
    });
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

  async function handleMoveToRootSpace() {
    if (selectedMoveItemIds.size === 0 || !space) return;
    try {
      await Promise.all([...selectedMoveItemIds].map((itemId) =>
        ItemService.moveItemToContainer(itemId, space.id, '')
      ));
      setShowMoveModal(false);
      setSelectedMoveItemIds(new Set());
      await loadItems();
    } catch {
      Alert.alert('Error', 'Failed to move some items');
    }
  }

  async function handleMoveToSpace(targetSpaceId: string) {
    if (selectedMoveItemIds.size === 0 || !space) return;
    try {
      await Promise.all([...selectedMoveItemIds].map((itemId) =>
        ItemService.moveItem(itemId, space.id, targetSpaceId)
      ));
      setShowMoveModal(false);
      setSelectedMoveItemIds(new Set());
      await loadItems();
    } catch {
      Alert.alert('Error', 'Failed to move some items');
    }
  }

  async function handleMoveToContainer(targetSpaceId: string, targetContainerId: string) {
    if (selectedMoveItemIds.size === 0) return;
    try {
      await Promise.all([...selectedMoveItemIds].map((itemId) =>
        ItemService.moveItemToContainer(itemId, targetSpaceId, targetContainerId)
      ));
      setShowMoveModal(false);
      setSelectedMoveItemIds(new Set());
      await loadItems();
    } catch {
      Alert.alert('Error', 'Failed to move some items');
    }
  }

  async function handleAddItem(name: string, description?: string, quantity?: number, photoUri?: string | null, warrantyExpiry?: Date | null, barcode?: ScannedBarcode | null, unitsPerPack?: number | null) {
    if (!space || !containerId) return;
    const item = await ItemService.createItem(space.id, name, containerId, description, quantity, null, unitsPerPack);
    if (barcode) {
      await BarcodeScannerService.linkItemToBarcode(item.id, barcode);
    }
    if (photoUri) {
      const savedUri = await PhotoService.savePhoto(photoUri, item.id);
      await ItemRepository.updatePhotoUri(item.id, savedUri);
    }
    if (warrantyExpiry) {
      const locationName = container?.name ?? space?.name ?? 'Unknown';
      await ItemService.updateWarranty(item.id, warrantyExpiry, locationName);
    }
    await loadItems();
  }

  async function handleContainerPhoto(source: 'camera' | 'gallery') {
    if (!containerId) return;
    setShowContainerPhotoPicker(false);
    try {
      const tempUri = source === 'camera'
        ? await PhotoService.captureFromCamera()
        : await PhotoService.pickFromGallery();
      if (!tempUri) return;
      if (container?.photoUri) await PhotoService.deletePhoto(container.photoUri);
      const savedUri = await PhotoService.savePhoto(tempUri, `container_${containerId}`);
      await ContainerRepository.updatePhotoUri(containerId, savedUri);
      await loadContainer();
    } catch {
      Alert.alert('Error', 'Failed to save photo');
    }
  }

  async function handleRemoveContainerPhoto() {
    if (!containerId) return;
    try {
      if (container?.photoUri) await PhotoService.deletePhoto(container.photoUri);
      await ContainerRepository.updatePhotoUri(containerId, null);
      await loadContainer();
    } catch {
      Alert.alert('Error', 'Failed to remove photo');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: borderColor, paddingTop: insets.top, backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
        <TouchableOpacity onPress={() => selectMode ? exitSelectMode() : router.back()} style={styles.backBtn}>
          <FontAwesomeIcon icon={selectMode ? faTimes : faChevronLeft} size={16} color={PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {selectMode ? (
            <Text style={[styles.headerTitle, { color: colors.text }]}>{selectedIds.size} selected</Text>
          ) : (
            <>
              {space && (
                <Text style={[styles.breadcrumb, { color: subtleText }]} numberOfLines={1}>
                  {space.name}
                </Text>
              )}
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {container?.name ?? 'Container'}
              </Text>
            </>
          )}
        </View>
        {!selectMode ? (
          <View style={styles.headerControls}>
            <TouchableOpacity style={styles.iconToggle} onPress={handleContainerMenuPress} accessibilityLabel="Container actions">
              <FontAwesomeIcon icon={faEllipsisVertical} size={15} color={PRIMARY} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleSelectAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: PRIMARY, fontSize: 14, fontWeight: '500' }}>All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Container Photo */}
      {!loading && container && (
        container.photoUri ? (
          <TouchableOpacity
            style={[styles.containerPhotoWrap, { borderColor }]}
            onPress={() => setShowContainerPhotoActions(true)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: container.photoUri }} style={styles.containerPhoto} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.containerPhotoPlaceholder, { backgroundColor: cardBg, borderColor }]}
            onPress={() => setShowContainerPhotoPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.containerPhotoPlaceholderText, { color: subtleText }]}>+ Add Container Photo</Text>
          </TouchableOpacity>
        )
      )}

      {!loading && container && (
        <View style={[styles.searchWrapper, { backgroundColor: cardBg, borderColor }]}>
          <FontAwesomeIcon icon={faMagnifyingGlass} size={14} color={colors.text} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search items in this container..."
            placeholderTextColor={subtleText}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchText('')}
              style={styles.clearSearchBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Clear search"
            >
              <FontAwesomeIcon icon={faTimes} size={13} color={subtleText} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <>
          <View style={styles.contentToolbar}>
            <Text style={[styles.sectionLabel, { color: subtleText, marginBottom: 0 }]} numberOfLines={1}>
              {searchText.trim()
                ? `${filteredItems.length} of ${items.length} item${items.length !== 1 ? 's' : ''}`
                : `${items.length} item${items.length !== 1 ? 's' : ''}`}
            </Text>
            <View style={styles.contentControls}>
              <View style={[styles.viewSegment, { backgroundColor: isDark ? '#1c1c1e' : '#eef0f3', borderColor }]}>
                <TouchableOpacity
                  style={[styles.segmentIconBtn, viewMode === 'list' && [styles.segmentIconBtnActive, { backgroundColor: cardBg }]]}
                  onPress={() => switchViewMode('list')}
                  accessibilityLabel="List view"
                >
                  <FontAwesomeIcon icon={faList} size={14} color={viewMode === 'list' ? PRIMARY : subtleText} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentIconBtn, viewMode === 'grid' && [styles.segmentIconBtnActive, { backgroundColor: cardBg }]]}
                  onPress={() => switchViewMode('grid')}
                  accessibilityLabel="Grid view"
                >
                  <FontAwesomeIcon icon={faGrip} size={14} color={viewMode === 'grid' ? PRIMARY : subtleText} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.sortFilterButton, { backgroundColor: cardBg, borderColor }]}
                onPress={() => setShowSortMenu(true)}
                accessibilityLabel="Sort items"
              >
                <FontAwesomeIcon icon={faFilter} size={13} color={PRIMARY} />
                <Text style={[styles.sortFilterText, { color: colors.text }]}>{sortLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            key={viewMode === 'grid' ? 'grid' : 'list'}
            numColumns={viewMode === 'grid' ? GRID_COLUMNS : 1}
            columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const activeLending = activeLendingMap[item.id];
            const isLent = !!activeLending;
            const isOutside = activeOutsideItemIds.has(item.id);
            const isLost = !!item.lostAt;
            const isSelected = selectedIds.has(item.id);

            if (viewMode === 'grid') {
              return (
                <TouchableOpacity
                  style={[styles.gridCard, { backgroundColor: cardBg, borderColor: isSelected ? PRIMARY : isLost ? '#d32f2f40' : isOutside ? '#e67e2240' : isLent ? `${LENDING}40` : borderColor, width: GRID_ITEM_WIDTH }, isSelected && styles.selectedCard]}
                  onPress={() => {
                    if (selectMode) { toggleSelect(item.id); return; }
                    router.push({ pathname: '../item/[id]' as any, params: { id: item.id } });
                  }}
                  onLongPress={() => {
                    if (!selectMode) enterSelectMode(item);
                    else toggleSelect(item.id);
                  }}
                  activeOpacity={0.7}
                >
                  {item.photoUri ? (
                    <Image source={{ uri: item.photoUri }} style={[styles.gridPhoto, { height: GRID_ITEM_WIDTH * 0.7 }]} />
                  ) : (
                    <View style={[styles.gridPhotoPlaceholder, { backgroundColor: `${PRIMARY}12`, height: GRID_ITEM_WIDTH * 0.7 }]}>
                      <FontAwesomeIcon icon={faBox} size={28} color={PRIMARY} />
                    </View>
                  )}
                  {selectMode && (
                    <View style={[styles.gridSelectBadge, isSelected && { backgroundColor: PRIMARY }]}>
                      {isSelected && <FontAwesomeIcon icon={faCheck} size={10} color="#fff" />}
                    </View>
                  )}
                  <View style={styles.gridContent}>
                    {isLost && <Text style={[styles.gridBadge, { color: '#d32f2f' }]}>Lost</Text>}
                    {isLent && <Text style={[styles.gridBadge, { color: LENDING }]}>Lent</Text>}
                    {isOutside && !isLent && <Text style={[styles.gridBadge, { color: '#e67e22' }]}>Outside</Text>}
                    <Text style={[styles.gridName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    {isLost && <Text style={[styles.gridMeta, { color: '#d32f2f' }]} numberOfLines={1}>Reported lost</Text>}
                    {isLent && <Text style={[styles.gridMeta, { color: LENDING }]} numberOfLines={1}>To {activeLending.borrower_name}</Text>}
                  </View>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: cardBg, borderColor: isSelected ? PRIMARY : isLost ? '#d32f2f40' : isOutside ? '#e67e2240' : isLent ? `${LENDING}40` : borderColor }, isSelected && styles.selectedCard]}
                onPress={() => {
                  if (selectMode) { toggleSelect(item.id); return; }
                  router.push({ pathname: '../item/[id]' as any, params: { id: item.id } });
                }}
                onLongPress={() => {
                  if (!selectMode) enterSelectMode(item);
                  else toggleSelect(item.id);
                }}
                activeOpacity={0.7}
                >
                {selectMode ? (
                  <View style={[styles.selectCircle, isSelected && { backgroundColor: PRIMARY, borderColor: PRIMARY }]}>
                    {isSelected && <FontAwesomeIcon icon={faCheck} size={10} color="#fff" />}
                  </View>
                ) : (
                  <View style={[styles.itemDot, { backgroundColor: isLost ? '#d32f2f' : isOutside ? '#e67e22' : isLent ? LENDING : isDark ? '#48484a' : '#c7c7cc' }]} />
                )}
                {item.photoUri ? (
                  <Image source={{ uri: item.photoUri }} style={styles.itemThumb} />
                ) : null}
                <View style={styles.itemTextWrap}>
                  <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {isLost && (
                    <Text style={[styles.itemLentMeta, { color: '#d32f2f' }]} numberOfLines={1}>
                      Reported lost
                    </Text>
                  )}
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
                {!selectMode && isLost && (
                  <View style={[styles.lentBadge, { backgroundColor: '#d32f2f15' }]}>
                    <Text style={[styles.lentBadgeText, { color: '#d32f2f' }]}>Lost</Text>
                  </View>
                )}
                {!selectMode && !isLost && isOutside && (
                  <View style={[styles.lentBadge, { backgroundColor: '#e67e2215' }]}>
                    <Text style={[styles.lentBadgeText, { color: '#e67e22' }]}>Outside</Text>
                  </View>
                )}
                {!selectMode && !isLost && !isOutside && isLent && (
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
                {searchText.trim()
                  ? 'No items match your search.'
                  : 'No items in this container yet.\nTap the button below to add one.'}
              </Text>
            </View>
          }
        />
        </>
      )}

      {/* Bottom Action Bar */}
      {!selectMode && (
      <View style={[styles.actionBar, { backgroundColor: cardBg, borderTopColor: borderColor, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[styles.actionBarBtn, { backgroundColor: PRIMARY }]}
          onPress={() => setShowAddItemModal(true)}
        >
          <Text style={[styles.actionBarBtnText, { color: '#fff' }]}>+ Add Item</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Move Bottom Sheet */}
      <Modal visible={showMoveModal} transparent animationType="slide" onRequestClose={() => setShowMoveModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowMoveModal(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.moveSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
            <Text style={[styles.moveSheetTitle, { color: colors.text }]}>Move {selectedMoveItemIds.size} Item{selectedMoveItemIds.size !== 1 ? 's' : ''}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* In this space: root + other containers (current container shown disabled) */}
              {space && (
                <>
                  <Text style={[styles.moveSectionLabel, { color: subtleText }]}>IN THIS SPACE</Text>
                  <TouchableOpacity style={[styles.moveOption, { borderColor }]} onPress={handleMoveToRootSpace}>
                    <FontAwesomeIcon icon={faMapPin} size={16} color={PRIMARY} />
                    <Text style={[styles.moveOptionText, { color: colors.text }]}>Root of {space.name}</Text>
                  </TouchableOpacity>
                  {(spaceContainers[space.id] ?? []).map((c) => {
                    const isCurrent = c.id === containerId;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.moveOption, isCurrent && styles.moveOptionDisabled, { borderColor }]}
                        onPress={isCurrent ? undefined : () => handleMoveToContainer(space.id, c.id)}
                        activeOpacity={isCurrent ? 1 : 0.7}
                      >
                        <FontAwesomeIcon icon={faFolder} size={16} color={isCurrent ? subtleText : PRIMARY} />
                        <Text style={[styles.moveOptionText, { color: isCurrent ? subtleText : colors.text }]}>{c.name}</Text>
                        {isCurrent && (
                          <View style={[styles.currentBadge, { backgroundColor: `${PRIMARY}18` }]}>
                            <Text style={[styles.currentBadgeText, { color: PRIMARY }]}>Here</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* Move to another space */}
              {allSpaces.filter((s) => s.id !== space?.id).length > 0 && (
                <>
                  <Text style={[styles.moveSectionLabel, { color: subtleText }]}>MOVE TO ANOTHER SPACE</Text>
                  {allSpaces.filter((s) => s.id !== space?.id).map((s) => (
                    <View key={s.id}>
                      <TouchableOpacity style={[styles.moveOption, { borderColor }]} onPress={() => handleMoveToSpace(s.id)}>
                        <FontAwesomeIcon icon={faMapPin} size={16} color={PRIMARY} />
                        <Text style={[styles.moveOptionText, { color: colors.text }]}>{s.name} (root)</Text>
                      </TouchableOpacity>
                      {(spaceContainers[s.id] ?? []).map((c) => (
                        <TouchableOpacity key={c.id} style={[styles.moveOption, styles.moveOptionIndented, { borderColor }]} onPress={() => handleMoveToContainer(s.id, c.id)}>
                          <FontAwesomeIcon icon={faFolder} size={16} color={PRIMARY} />
                          <Text style={[styles.moveOptionText, { color: colors.text }]}>{c.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
                <TouchableOpacity style={[styles.moveCancelBtn, { borderColor }]} onPress={() => setShowMoveModal(false)}>
                  <Text style={[styles.moveCancelText, { color: subtleText }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Move Container Modal */}
      <Modal visible={showMoveContainerModal} transparent animationType="slide" onRequestClose={() => setShowMoveContainerModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowMoveContainerModal(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.moveSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
                <Text style={[styles.moveSheetTitle, { color: colors.text }]}>Move Container to</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {allSpaces.filter((s) => s.id !== space?.id).length === 0 ? (
                    <Text style={[styles.moveOptionText, { color: subtleText, paddingVertical: 12 }]}>No other spaces available.</Text>
                  ) : (
                    allSpaces.filter((s) => s.id !== space?.id).map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.moveOption, { borderColor }]}
                        onPress={() => handleMoveContainerToSpace(s.id)}
                      >
                        <FontAwesomeIcon icon={faMapPin} size={16} color={PRIMARY} />
                        <Text style={[styles.moveOptionText, { color: colors.text }]}>{s.name}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
                <TouchableOpacity style={[styles.moveCancelBtn, { borderColor }]} onPress={() => setShowMoveContainerModal(false)}>
                  <Text style={[styles.moveCancelText, { color: subtleText }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ItemFormModal
        visible={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        onSubmit={handleAddItem}
        contextLabel={container?.name}
      />

      {/* Sort Sheet */}
      <Modal visible={showSortMenu} transparent animationType="fade" onRequestClose={() => setShowSortMenu(false)}>
        <TouchableWithoutFeedback onPress={() => setShowSortMenu(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetTitleWrap}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>Sort Items</Text>
                    <Text style={[styles.sheetSubtitle, { color: subtleText }]} numberOfLines={1}>
                      Items in {container?.name ?? 'container'}, {sortLabel}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowSortMenu(false)} style={styles.sheetCloseBtn} accessibilityLabel="Close sort">
                    <FontAwesomeIcon icon={faTimes} size={16} color={subtleText} />
                  </TouchableOpacity>
                </View>
                <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.menuTitle, { color: subtleText }]}>Sort by</Text>
                  {([
                    { key: 'name-asc' as SortMode, icon: faArrowDownAZ, label: 'Name A-Z' },
                    { key: 'name-desc' as SortMode, icon: faArrowDownZA, label: 'Name Z-A' },
                    { key: 'newest' as SortMode, icon: faCalendarPlus, label: 'Newest first' },
                    { key: 'oldest' as SortMode, icon: faCalendar, label: 'Oldest first' },
                  ]).map((opt) => (
                    <TouchableOpacity key={opt.key} style={[styles.menuOption, sortMode === opt.key && styles.menuOptionActive]} onPress={() => switchSortMode(opt.key)} activeOpacity={0.7}>
                      <FontAwesomeIcon icon={opt.icon} size={14} color={sortMode === opt.key ? PRIMARY : subtleText} />
                      <Text style={[styles.menuOptionText, { color: sortMode === opt.key ? PRIMARY : colors.text }]}>{opt.label}</Text>
                      {sortMode === opt.key && <FontAwesomeIcon icon={faCheck} size={12} color={PRIMARY} style={styles.menuCheck} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Container action menu */}
      <Modal visible={showContainerMenu} transparent animationType="fade" onRequestClose={() => setShowContainerMenu(false)}>
        <TouchableWithoutFeedback onPress={() => setShowContainerMenu(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetTitleWrap}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>Container Actions</Text>
                    <Text style={[styles.sheetSubtitle, { color: subtleText }]} numberOfLines={1}>
                      {container?.name ?? 'Container'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowContainerMenu(false)} style={styles.sheetCloseBtn} accessibilityLabel="Close container actions">
                    <FontAwesomeIcon icon={faTimes} size={16} color={subtleText} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.menuOption]} onPress={() => { setShowContainerMenu(false); setEditingContainer(container); }} activeOpacity={0.7}>
                  <FontAwesomeIcon icon={faPen} size={14} color={PRIMARY} />
                  <Text style={[styles.menuOptionText, { color: colors.text }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuOption]} onPress={() => { setShowContainerMenu(false); setShowMoveContainerModal(true); }} activeOpacity={0.7}>
                  <FontAwesomeIcon icon={faRightLeft} size={14} color={PRIMARY} />
                  <Text style={[styles.menuOptionText, { color: colors.text }]}>Move</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuOption]} onPress={openContainerPrintableLabel} activeOpacity={0.7}>
                  <FontAwesomeIcon icon={faQrcode} size={14} color={PRIMARY} />
                  <Text style={[styles.menuOptionText, { color: colors.text }]}>Print label</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuOption]} onPress={() => { setShowContainerMenu(false); confirmDeleteContainer(); }} activeOpacity={0.7}>
                  <FontAwesomeIcon icon={faTrash} size={14} color="#d32f2f" />
                  <Text style={[styles.menuOptionText, { color: '#d32f2f' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <LendingFormModal
        visible={showLendModal}
        item={selectedLendItem}
        borrowerName={borrowerName}
        onBorrowerNameChange={setBorrowerName}
        quantity={lendQuantity}
        onQuantityChange={setLendQuantity}
        note={lendNote}
        onNoteChange={setLendNote}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        onSubmit={handleLendSubmit}
        onCancel={() => { setShowLendModal(false); setBorrowerName(''); setLendQuantity('1'); setLendNote(''); setDueDate(null); setLendBeforePhotoUris([]); setSelectedLendItem(null); }}
        loading={lendLoading}
        beforePhotoUris={lendBeforePhotoUris}
        onBeforePhotosChange={setLendBeforePhotoUris}
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
          const isLost = !!item.lostAt;
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
              'Mark this item as found before moving or lending it.'
            );
          return [
            {
              icon: faBox,
              label: 'Move',
              description: isLost ? 'Item is marked lost' : isOutside ? 'In active outside session' : isLent ? 'Item is currently lent out' : 'Move to another space or container',
              onPress: isLost ? lostGuard : isOutside ? outsideGuard : isLent ? lendingGuard : () => { setSelectedMoveItemIds(new Set([item.id])); setShowMoveModal(true); },
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
                  description: isLost ? 'Item is marked lost' : isOutside ? 'In active outside session' : 'Track who you lent this item to',
                  onPress: isLost ? lostGuard : isOutside ? outsideGuard : () => { setSelectedLendItem(item); setBorrowerName(''); setLendQuantity('1'); setLendNote(''); setDueDate(null); setLendBeforePhotoUris([]); setShowLendModal(true); },
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

      <PhotoPickerSheet
        visible={showContainerPhotoPicker}
        onClose={() => setShowContainerPhotoPicker(false)}
        onCamera={() => handleContainerPhoto('camera')}
        onGallery={() => handleContainerPhoto('gallery')}
      />
      <PhotoActionSheet
        visible={showContainerPhotoActions}
        title={container?.name ?? 'Container photo'}
        onView={() => setShowContainerPhotoViewer(true)}
        onReplace={() => setShowContainerPhotoPicker(true)}
        onRemove={handleRemoveContainerPhoto}
        onClose={() => setShowContainerPhotoActions(false)}
      />
      <PhotoViewModal
        visible={showContainerPhotoViewer}
        uri={container?.photoUri ?? null}
        title={container?.name ?? 'Container photo'}
        onClose={() => setShowContainerPhotoViewer(false)}
      />

      {/* Bulk action toolbar */}
      {selectMode && (() => {
        const canEdit = selectedIds.size === 1;
        
        // Can move multiple items if none are lent or outside
        let canMove = selectedIds.size > 0;
        if (canMove) {
          for (const id of selectedIds) {
            if (activeOutsideItemIds.has(id) || activeLendingMap[id] || items.find((item) => item.id === id)?.lostAt) {
              canMove = false;
              break;
            }
          }
        }
        
        const canDelete = selectedIds.size > 0;

        // Logic for Lend/Return button
        let lendActionLabel = 'Lend';
        let lendActionIcon = faHandshake;
        let lendActionColor = LENDING;
        let lendActionOnPress = handleBulkLend;
        let lendActionDisabled = true;

        if (selectedIds.size === 1) {
          const selectedItem = items.find((i) => i.id === [...selectedIds][0]);
          if (selectedItem) {
            const activeLendingForItem = activeLendingMap[selectedItem.id];
            const isOutside = activeOutsideItemIds.has(selectedItem.id);
            const isLost = !!selectedItem.lostAt;

            if (activeLendingForItem) {
              lendActionLabel = 'Return';
              lendActionIcon = faCheck;
              lendActionColor = PRIMARY;
              lendActionOnPress = async () => {
                await handleMarkReturned(activeLendingForItem.id, selectedItem);
                exitSelectMode();
              };
              lendActionDisabled = false;
            } else if (isLost) {
              lendActionDisabled = true; // Cannot lend if lost
            } else if (isOutside) {
              lendActionDisabled = true; // Cannot lend if outside
            } else {
              lendActionOnPress = handleBulkLend;
              lendActionDisabled = false;
            }
          }
        }
        return (
          <View style={[styles.bulkToolbar, { backgroundColor: cardBg, borderColor, bottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.bulkAction, { opacity: canEdit ? 1 : 0.4 }]}
              onPress={handleBulkEdit}
              disabled={!canEdit}
            >
              <FontAwesomeIcon icon={faPen} size={18} color={PRIMARY} />
              <Text style={[styles.bulkActionLabel, { color: PRIMARY }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkAction, { opacity: canMove ? 1 : 0.4 }]}
              onPress={handleBulkMove}
              disabled={!canMove}
            >
              <FontAwesomeIcon icon={faRightLeft} size={18} color={PRIMARY} />
              <Text style={[styles.bulkActionLabel, { color: PRIMARY }]}>Move</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkAction, { opacity: lendActionDisabled ? 0.4 : 1 }]}
              onPress={lendActionOnPress}
              disabled={lendActionDisabled}
            >
              <FontAwesomeIcon icon={lendActionIcon} size={18} color={lendActionColor} />
              <Text style={[styles.bulkActionLabel, { color: lendActionColor }]}>{lendActionLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkAction, { opacity: canDelete ? 1 : 0.4 }]}
              onPress={handleBulkDelete}
              disabled={!canDelete}
            >
              <FontAwesomeIcon icon={faTrash} size={18} color="#d32f2f" />
              <Text style={[styles.bulkActionLabel, { color: '#d32f2f' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Edit Item Modal */}
      <ItemFormModal
        visible={editingItem !== null}
        onClose={() => setEditingItem(null)}
        onSubmit={handleEditItemSubmit}
        editMode
        initialName={editingItem?.name}
        initialDescription={editingItem?.description ?? undefined}
        initialQuantity={editingItem?.quantity}
        initialUnitsPerPack={editingItem?.unitsPerPack}
        initialPhotoUri={editingItem?.photoUri}
      />
      <ContainerFormModal
        visible={editingContainer !== null}
        onClose={() => setEditingContainer(null)}
        onSubmit={handleEditContainerSubmit}
        editMode
        initialName={editingContainer?.name}
        initialDescription={editingContainer?.description}
        initialPhotoUri={editingContainer?.photoUri}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { paddingRight: 12, paddingVertical: 8 },
  backBtnText: { fontSize: 16, fontWeight: '500' },
  headerCenter: { flex: 1, alignItems: 'center' },
  breadcrumb: { fontSize: 11, fontWeight: '500', letterSpacing: 0.2, marginBottom: 1 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  headerMenuBtn: { paddingLeft: 12, paddingVertical: 8 },
  headerControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconToggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconToggleActive: { backgroundColor: 'rgba(107,127,153,0.12)' },
  containerPhotoWrap: { marginHorizontal: 16, marginTop: 8, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  containerPhoto: { width: '100%', height: 160 },
  containerPhotoPlaceholder: { marginHorizontal: 16, marginTop: 8, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', paddingVertical: 14, alignItems: 'center' },
  containerPhotoPlaceholderText: { fontSize: 14, fontWeight: '500' },
  searchWrapper: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  clearSearchBtn: { padding: 4 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  menuSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '78%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  sheetTitleWrap: { flex: 1 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  sheetSubtitle: { fontSize: 13, marginTop: 2 },
  sheetCloseBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  menuCard: { borderRadius: 14, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 4, minWidth: 180, maxHeight: '60%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  menuTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4, textTransform: 'uppercase' },
  menuOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, marginBottom: 4 },
  menuOptionActive: { backgroundColor: 'rgba(107,127,153,0.1)' },
  menuOptionText: { fontSize: 14, fontWeight: '500', flex: 1 },
  menuCheck: { marginLeft: 'auto' },
  menuDivider: { height: 1, marginVertical: 6, marginHorizontal: 8 },

  // Grid
  gridRow: { gap: GRID_GAP },
  gridCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: GRID_GAP },
  gridPhoto: { width: '100%', resizeMode: 'cover' },
  gridPhotoPlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  gridContent: { padding: 10 },
  gridBadge: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2 },
  gridName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  gridMeta: { fontSize: 11 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 12 },
  contentToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8, gap: 12 },
  contentControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewSegment: { height: 34, flexDirection: 'row', alignItems: 'center', borderRadius: 9, borderWidth: 1, padding: 2, gap: 2 },
  segmentIconBtn: { width: 32, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segmentIconBtnActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  sortFilterButton: { height: 34, minWidth: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, gap: 6 },
  sortFilterText: { fontSize: 12, fontWeight: '700' },
  itemCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 6, gap: 10 },
  itemDot: { width: 6, height: 6, borderRadius: 3 },
  itemThumb: { width: 40, height: 40, borderRadius: 8 },
  itemTextWrap: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '500' },
  itemLentMeta: { fontSize: 12, marginTop: 2 },
  lentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  lentBadgeText: { fontSize: 11, fontWeight: '600' },
  itemMoreDots: { fontSize: 14, letterSpacing: 1 },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 28, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  actionBarBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  actionBarBtnText: { fontSize: 15, fontWeight: '600' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  moveSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '70%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  moveSheetTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 16 },
  moveSectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  moveOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6, gap: 12 },
  moveOptionDisabled: { opacity: 0.6 },
  moveOptionIndented: { marginLeft: 16 },
  moveOptionIcon: { fontSize: 16 },
  moveOptionText: { fontSize: 15, fontWeight: '500', flex: 1 },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  currentBadgeText: { fontSize: 11, fontWeight: '600' },
  moveCancelBtn: { marginTop: 12, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  moveCancelText: { fontSize: 15, fontWeight: '600' },

  // Select mode
  selectCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c0c0c0', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  selectedCard: { borderWidth: 2 },
  gridSelectBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c0c0c0', backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  bulkToolbar: { position: 'absolute', left: 20, right: 20, borderRadius: 16, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-around', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
  bulkAction: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12, gap: 4, minWidth: 50 },
  bulkActionLabel: { fontSize: 11, fontWeight: '600' },
});

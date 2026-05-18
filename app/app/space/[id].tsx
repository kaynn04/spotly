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

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  TouchableWithoutFeedback,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMagnifyingGlass, faTimes, faChevronRight, faFolder, faChevronLeft, faBox, faHandshake, faCheck, faTrash, faMapPin, faArrowDownAZ, faArrowDownZA, faCalendarPlus, faCalendar, faFilter, faList, faGrip, faPen, faRightLeft, faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
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
import PhotoActionSheet from '@/components/PhotoActionSheet';
import PhotoPickerSheet from '@/components/PhotoPickerSheet';
import PhotoViewModal from '@/components/PhotoViewModal';
import { Lending } from '@/src/features/lending/models/Lending';
import { OutsideService } from '@/src/features/outside/services/OutsideService';
import ItemFormModal from '@/src/features/spaces/screens/components/ItemFormModal';
import ContainerFormModal from '@/src/features/spaces/screens/components/ContainerFormModal';
import LendingFormModal from '@/src/features/lending/screens/components/LendingFormModal';
import SpaceFormModal from '@/src/features/spaces/screens/components/SpaceFormModal';
import ItemActionSheet from '@/src/features/spaces/screens/components/ItemActionSheet';

const PRIMARY = '#6b7f99';
const LENDING = '#9b72cb';

const SPACE_SORT_KEY = 'synop:space-detail-sort';
const SPACE_VIEW_KEY = 'synop:space-detail-view';
type SortMode = 'name-asc' | 'name-desc' | 'newest' | 'oldest';
type ViewMode = 'list' | 'grid';
const GRID_GAP = 10;
const GRID_PADDING = 16;
const GRID_COLUMNS = 2;

type ListEntry =
  | { type: 'container'; data: Container }
  | { type: 'item'; data: Item };

export default function SpaceDetailScreen() {
  const router = useRouter();
  const { id, openAddContainer, openAddItem } = useLocalSearchParams<{ id: string; openAddContainer?: string; openAddItem?: string }>();
  const openAddContainerOnce = useRef(openAddContainer === '1');
  const openAddItemOnce = useRef(openAddItem === '1');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const { width: screenWidth } = useWindowDimensions();
  const GRID_ITEM_WIDTH = (screenWidth - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const [space, setSpace] = useState<Space | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddContainerModal, setShowAddContainerModal] = useState(false);
  const [showSpacePhotoActions, setShowSpacePhotoActions] = useState(false);
  const [showSpacePhotoPicker, setShowSpacePhotoPicker] = useState(false);
  const [showSpacePhotoViewer, setShowSpacePhotoViewer] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedMoveItemIds, setSelectedMoveItemIds] = useState<Set<string>>(new Set());
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
  const [selectedMoveContainerIds, setSelectedMoveContainerIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('name-asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterSegment, setFilterSegment] = useState<'all' | 'containers' | 'items' | 'lent'>('all');
  // Map of item_id → active Lending (null = not lent)
  const [activeLendingMap, setActiveLendingMap] = useState<Record<string, Lending>>({});
  // Set of item IDs currently in an active outside session
  const [activeOutsideItemIds, setActiveOutsideItemIds] = useState<Set<string>>(new Set());

  // Select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectModeRef = useRef(false);
  selectModeRef.current = selectMode;
  const [showSpaceMenu, setShowSpaceMenu] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);

  const lendingService = useMemo(
    () => new LendingService(new LendingRepository(), new ItemRepository()),
    []
  );
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const outsideService = useMemo(() => new OutsideService(), []);

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  // Load persisted preferences
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SPACE_SORT_KEY),
      AsyncStorage.getItem(SPACE_VIEW_KEY),
    ]).then(([s, v]) => {
      if (s === 'name-asc' || s === 'name-desc' || s === 'newest' || s === 'oldest') setSortMode(s);
      if (v === 'list' || v === 'grid') setViewMode(v);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadAll();
    // loadAll intentionally refreshes all local screen resources for this route id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-open modal when navigated here via the + button
  useEffect(() => {
    if (!loading) {
      if (openAddContainerOnce.current) {
        openAddContainerOnce.current = false;
        setShowAddContainerModal(true);
      } else if (openAddItemOnce.current) {
        openAddItemOnce.current = false;
        setShowAddItemModal(true);
      }
    }
  }, [loading]);

  useFocusEffect(
    useCallback(() => {
      if (id) { loadItems(); loadContainers(); loadActiveLendings(); loadActiveOutsideItems(); }
      // These loaders are stable for the current route id during focus refresh.
      // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function closeMoveContainerModal() {
    setShowMoveContainerModal(false);
    setSelectedMoveContainer(null);
    setSelectedMoveContainerIds(new Set());
  }

  function getBlockedContainerItems(containerIds: string[]) {
    return items.filter((item) =>
      item.containerId &&
      containerIds.includes(item.containerId) &&
      (activeOutsideItemIds.has(item.id) || !!activeLendingMap[item.id])
    );
  }

  async function handleMoveContainerToSpace(targetSpaceId: string) {
    const containerIds = selectedMoveContainer
      ? [selectedMoveContainer.id]
      : [...selectedMoveContainerIds];

    if (containerIds.length === 0) return;

    const blockedItems = getBlockedContainerItems(containerIds);
    if (blockedItems.length > 0) {
      const blockedNames = blockedItems.map((item) => item.name).join(', ');
      Alert.alert(
        'Items are Blocked',
        `Cannot move container${containerIds.length !== 1 ? 's' : ''}: ${blockedNames} ${blockedItems.length === 1 ? 'is' : 'are'} lent or in an outside session. Complete these tasks first.`
      );
      return;
    }

    try {
      // Run sequentially because each move opens a DB transaction.
      // Parallel transactions can conflict on SQLite and fail bulk moves.
      for (const containerId of containerIds) {
        await ContainerService.moveContainer(containerId, targetSpaceId);
      }
      closeMoveContainerModal();
      await loadContainers();
      await loadItems();
    } catch {
      Alert.alert('Error', `Failed to move container${containerIds.length !== 1 ? 's' : ''}`);
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

  async function openMoveModal(itemIds: Set<string>) {
    setSelectedMoveItemIds(itemIds);
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
    if (selectedMoveItemIds.size === 0) return;
    try {
      await Promise.all([...selectedMoveItemIds].map((itemId) =>
        ItemService.moveItemToContainer(itemId, targetSpaceId, containerId)
      ));
      setShowMoveModal(false);
      setSelectedMoveItemIds(new Set());
      await loadItems();
    } catch { Alert.alert('Error', 'Failed to move item'); }
  }

  async function handleMoveToSpace(targetSpaceId: string) {
    if (selectedMoveItemIds.size === 0 || !id) return;
    try {
      await Promise.all([...selectedMoveItemIds].map((itemId) => {
        if (targetSpaceId === id) {
          return ItemService.moveItemToContainer(itemId, id, '');
        } else {
          return ItemService.moveItem(itemId, id, targetSpaceId);
        }
      }));
      setShowMoveModal(false);
      setSelectedMoveItemIds(new Set());
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
        due_date: dueDate ?? undefined,
      });
      setShowLendModal(false);
      setBorrowerName('');
      setLendNote('');
      setDueDate(null);
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

  // --- Select mode ---
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectModeRef.current) { exitSelectMode(); return true; }
      return false;
    });
    return () => sub.remove();
  }, []);

  const enterSelectMode = (entry: ListEntry) => {
    setSelectMode(true);
    setSelectedIds(new Set([entry.data.id]));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (entry: ListEntry) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entry.data.id)) next.delete(entry.data.id);
      else next.add(entry.data.id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredData.map((e) => e.data.id)));
  };

  const handleBulkDelete = () => {
    const itemIds = [...selectedIds].filter((sid) => items.some((i) => i.id === sid));
    const containerIds = [...selectedIds].filter((sid) => containers.some((c) => c.id === sid));
    const count = selectedIds.size;
    const hasContainers = containerIds.length > 0;
    Alert.alert(
      `Delete ${count} ${count !== 1 ? 'items' : 'item'}`,
      `This will permanently delete ${count} selected ${count !== 1 ? 'items' : 'item'}${hasContainers ? ' and their contents' : ''}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await Promise.all([
              ...itemIds.map((iid) => ItemService.deleteItem(iid)),
              ...containerIds.map((cid) => ContainerService.deleteContainer(cid)),
            ]);
            exitSelectMode();
            await loadItems();
            await loadContainers();
          } catch { Alert.alert('Error', 'Some items could not be deleted'); }
        }},
      ]
    );
  };

  const handleBulkEdit = () => {
    if (selectedIds.size !== 1) return;
    const entryId = [...selectedIds][0];
    const item = items.find((i) => i.id === entryId);
    if (item) {
      setEditingItem(item);
      return;
    }
    const c = containers.find((cc) => cc.id === entryId);
    if (c) {
      setEditingContainer(c);
    }
  };

  const handleBulkMove = () => {
    const selItemIds = [...selectedIds].filter((sid) => items.some((i) => i.id === sid));
    const selContainerIds = [...selectedIds].filter((sid) => containers.some((c) => c.id === sid));

    if (selItemIds.length > 0 && selContainerIds.length > 0) {
      Alert.alert('Mixed Selection', 'Move items and containers separately so each destination is clear.');
      return;
    }

    if (selContainerIds.length > 0) {
      const blockedItems = getBlockedContainerItems(selContainerIds);
      if (blockedItems.length > 0) {
        const blockedNames = blockedItems.map((item) => item.name).join(', ');
        Alert.alert(
          'Items are Blocked',
          `Cannot move container${selContainerIds.length !== 1 ? 's' : ''}: ${blockedNames} ${blockedItems.length === 1 ? 'is' : 'are'} lent or in an outside session. Complete these tasks first.`
        );
        return;
      }

      exitSelectMode();
      setSelectedMoveContainer(null);
      setSelectedMoveContainerIds(new Set(selContainerIds));
      setShowMoveContainerModal(true);
      return;
    }

    if (selItemIds.length === 0) return;

    // Check if any selected items are lent, outside, or lost
    const blockedItems = selItemIds.filter((itemId) =>
      activeOutsideItemIds.has(itemId) || !!activeLendingMap[itemId] || !!items.find((i) => i.id === itemId)?.lostAt
    );

    if (blockedItems.length > 0) {
      const blockedNames = blockedItems
        .map((bid) => items.find((i) => i.id === bid)?.name ?? bid)
        .join(', ');
      Alert.alert(
        'Items are Blocked',
        `Cannot move: ${blockedNames}. Complete outside sessions, mark lent items as returned, or mark lost items as found first.`
      );
      return;
    }

    const moveIds = new Set(selItemIds);
    exitSelectMode();
    openMoveModal(moveIds);
  };

  const handleBulkLend = () => {
    if (selectedIds.size !== 1 || !items.some((i) => i.id === [...selectedIds][0])) return;
    const itemId = [...selectedIds][0];
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const isOutside = activeOutsideItemIds.has(item.id);
    const isLent = !!activeLendingMap[item.id];
    const isLost = !!item.lostAt;
    if (isLost) {
      Alert.alert('Item is Lost', 'Mark this item as found before lending.');
      return;
    }
    if (isOutside) {
      Alert.alert('Item is Outside', 'Complete the outside session before lending.');
      return;
    }
    if (isLent) {
      Alert.alert('Already Lent', 'This item is already lent out.');
      return;
    }
    exitSelectMode();
    setSelectedLendItem(item);
    setBorrowerName('');
    setLendNote('');
    setDueDate(null);
    setShowLendModal(true);
  };

  const handleEditItemSubmit = async (name: string, description?: string, quantity?: number, photoUri?: string | null) => {
    if (!editingItem) return;
    await ItemService.updateItem(editingItem.id, { name, description: description ?? null, quantity: quantity ?? 1 });
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

  const handleEditContainerSubmit = async (name: string, photoUri?: string | null) => {
    if (!editingContainer) return;

    await ContainerService.updateContainer(editingContainer.id, { name });

    if (photoUri && photoUri !== editingContainer.photoUri) {
      const savedUri = await PhotoService.savePhoto(photoUri, `container_${editingContainer.id}`);
      await ContainerRepository.updatePhotoUri(editingContainer.id, savedUri);
    } else if (!photoUri && editingContainer.photoUri) {
      await PhotoService.deletePhoto(editingContainer.photoUri);
      await ContainerRepository.updatePhotoUri(editingContainer.id, null);
    }

    setEditingContainer(null);
    exitSelectMode();
    await loadContainers();
  };

  const handleEditSpaceSubmit = async (name: string, photoUri?: string | null) => {
    if (!space) return;
    await SpaceRepository.updateName(space.id, name);
    if (photoUri && photoUri !== space.photoUri) {
      const savedUri = await PhotoService.savePhoto(photoUri, `space_${space.id}`);
      await SpaceRepository.updatePhotoUri(space.id, savedUri);
    } else if (!photoUri && space.photoUri) {
      await PhotoService.deletePhoto(space.photoUri);
      await SpaceRepository.updatePhotoUri(space.id, null);
    }
    setEditingSpace(null);
    await loadSpace();
  };

  async function handleAddItem(name: string, description?: string, quantity?: number, photoUri?: string | null, warrantyExpiry?: Date | null) {
    // Create item first to get the ID, then save photo if provided
    const item = await ItemService.createItem(id!, name, null, description, quantity);
    if (photoUri) {
      const savedUri = await PhotoService.savePhoto(photoUri, item.id);
      await ItemRepository.updatePhotoUri(item.id, savedUri);
    }
    if (warrantyExpiry) {
      const locationName = space?.name ?? 'Unknown';
      await ItemService.updateWarranty(item.id, warrantyExpiry, locationName);
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

  const switchSortMode = (mode: SortMode) => {
    setSortMode(mode);
    AsyncStorage.setItem(SPACE_SORT_KEY, mode).catch(() => {});
    setShowMenu(false);
  };

  const switchViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    AsyncStorage.setItem(SPACE_VIEW_KEY, mode).catch(() => {});
    setShowMenu(false);
  };

  const sortLabel =
    sortMode === 'name-asc' ? 'A-Z' :
    sortMode === 'name-desc' ? 'Z-A' :
    sortMode === 'newest' ? 'Newest' :
    'Oldest';

  const spaceLevelItems = items.filter((item) => !item.containerId);

  // Sort items and containers
  const sortedContainers = useMemo(() => {
    const sorted = [...containers];
    switch (sortMode) {
      case 'name-asc': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'newest': sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
      case 'oldest': sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); break;
    }
    return sorted;
  }, [containers, sortMode]);

  const sortedItems = useMemo(() => {
    const sorted = [...spaceLevelItems];
    switch (sortMode) {
      case 'name-asc': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'newest': sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
      case 'oldest': sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); break;
    }
    return sorted;
  }, [spaceLevelItems, sortMode]);

  // Filter logic: combine search + segment filter
  const searchLower = searchText.toLowerCase();
  const allEntries: ListEntry[] = [
    ...sortedContainers.map((c) => ({ type: 'container' as const, data: c })),
    ...sortedItems.map((i) => ({ type: 'item' as const, data: i })),
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

  const visibleContainerCount = filteredData.filter((entry) => entry.type === 'container').length;
  const visibleItemCount = filteredData.filter((entry) => entry.type === 'item').length;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: borderColor, paddingTop: insets.top, backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
        <TouchableOpacity onPress={() => selectMode ? exitSelectMode() : router.back()} style={styles.backBtn}>
          <FontAwesomeIcon icon={selectMode ? faTimes : faChevronLeft} size={16} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {selectMode ? `${selectedIds.size} selected` : (space?.name ?? 'Space')}
        </Text>
        {!selectMode && (
          <View style={styles.headerControls}>
            <TouchableOpacity onPress={() => setShowSpaceMenu(true)} style={styles.iconToggle} accessibilityLabel="Space actions">
              <FontAwesomeIcon icon={faEllipsisVertical} size={15} color={PRIMARY} />
            </TouchableOpacity>
          </View>
        )}
        {selectMode && (
          <TouchableOpacity onPress={handleSelectAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: PRIMARY, fontSize: 14, fontWeight: '500' }}>All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Space Photo */}
      {!loading && space && (
        space.photoUri ? (
          <TouchableOpacity
            style={[styles.spacePhotoWrap, { borderColor }]}
            onPress={() => setShowSpacePhotoActions(true)}
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

          <View style={styles.contentToolbar}>
            <Text style={[styles.sectionLabel, { color: subtleText, marginBottom: 0 }]} numberOfLines={1}>
              {visibleContainerCount} container{visibleContainerCount !== 1 ? 's' : ''} {'\u00B7'} {visibleItemCount} item{visibleItemCount !== 1 ? 's' : ''}
            </Text>
            <View style={styles.contentControls}>
              <View style={[styles.viewSegment, { backgroundColor: isDark ? '#1c1c1e' : '#eef0f3', borderColor }]}>
                <TouchableOpacity
                  onPress={() => switchViewMode('list')}
                  style={[styles.segmentIconBtn, viewMode === 'list' && [styles.segmentIconBtnActive, { backgroundColor: cardBg }]]}
                  accessibilityLabel="List view"
                >
                  <FontAwesomeIcon icon={faList} size={14} color={viewMode === 'list' ? PRIMARY : subtleText} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => switchViewMode('grid')}
                  style={[styles.segmentIconBtn, viewMode === 'grid' && [styles.segmentIconBtnActive, { backgroundColor: cardBg }]]}
                  accessibilityLabel="Grid view"
                >
                  <FontAwesomeIcon icon={faGrip} size={14} color={viewMode === 'grid' ? PRIMARY : subtleText} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setShowMenu(true)}
                style={[styles.sortFilterButton, { backgroundColor: cardBg, borderColor }]}
                accessibilityLabel="Sort contents"
              >
                <FontAwesomeIcon icon={faFilter} size={13} color={PRIMARY} />
                <Text style={[styles.sortFilterText, { color: colors.text }]}>{sortLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          <FlatList
            data={filteredData}
            keyExtractor={(entry) =>
              entry.type === 'container' ? `c-${entry.data.id}` : `i-${entry.data.id}`
            }
            key={viewMode === 'grid' ? 'grid' : 'list'}
            numColumns={viewMode === 'grid' ? GRID_COLUMNS : 1}
            columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={null}
            renderItem={({ item: entry }) => {
              const isSelected = selectedIds.has(entry.data.id);

              if (viewMode === 'grid') {
                const isContainer = entry.type === 'container';
                const c = isContainer ? entry.data as Container : null;
                const item = !isContainer ? entry.data as Item : null;
                const photoUri = isContainer ? c?.photoUri : item?.photoUri;
                const name = entry.data.name;
  const activeLending = item ? activeLendingMap[item.id] : null;
  const isLent = !!activeLending;
  const isOutside = item ? activeOutsideItemIds.has(item.id) : false;
  const isLost = !!item?.lostAt;
  const count = isContainer ? items.filter((i) => i.containerId === c!.id).length : null;
  const meta = isContainer
    ? `${count} ${count === 1 ? 'item' : 'items'}`
    : isLost ? 'Reported lost' : isLent ? `Lent to ${activeLending!.borrower_name}` : isOutside ? 'Outside' : '';
                return (
                  <TouchableOpacity
                    style={[styles.gridCard, { backgroundColor: cardBg, borderColor: isSelected ? PRIMARY : borderColor, width: GRID_ITEM_WIDTH }, isSelected && styles.selectedCard]}
                    onPress={() => {
                      if (selectMode) { toggleSelect(entry); return; }
                      if (isContainer) router.push({ pathname: '../container/[id]' as any, params: { id: c!.id } });
                      else router.push({ pathname: '../item/[id]' as any, params: { id: item!.id } });
                    }}
                    onLongPress={() => {
                      if (!selectMode) enterSelectMode(entry);
                      else toggleSelect(entry);
                    }}
                    activeOpacity={0.7}
                  >
                    {photoUri ? (
                      <Image source={{ uri: photoUri }} style={[styles.gridPhoto, { height: GRID_ITEM_WIDTH * 0.7 }]} />
                    ) : (
                      <View style={[styles.gridPhotoPlaceholder, { backgroundColor: `${PRIMARY}12`, height: GRID_ITEM_WIDTH * 0.7 }]}>
                        <FontAwesomeIcon icon={isContainer ? faFolder : faBox} size={28} color={PRIMARY} />
                      </View>
                    )}
                    {selectMode && (
                      <View style={[styles.gridSelectBadge, isSelected && { backgroundColor: PRIMARY }]}>
                        {isSelected && <FontAwesomeIcon icon={faCheck} size={10} color="#fff" />}
                      </View>
                    )}
                    <View style={styles.gridContent}>
                      {isContainer && (
                        <Text style={[styles.gridBadge, { color: PRIMARY }]}>Container</Text>
                      )}
                      {isLost && (
                        <Text style={[styles.gridBadge, { color: '#d32f2f' }]}>Lost</Text>
                      )}
                      {!isLost && isLent && (
                        <Text style={[styles.gridBadge, { color: LENDING }]}>Lent</Text>
                      )}
                      {!isLost && isOutside && !isLent && (
                        <Text style={[styles.gridBadge, { color: '#e67e22' }]}>Outside</Text>
                      )}
                      <Text style={[styles.gridName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                      {meta ? <Text style={[styles.gridMeta, { color: subtleText }]} numberOfLines={1}>{meta}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              }

              if (entry.type === 'container') {
                const c = entry.data;
                const count = items.filter((i) => i.containerId === c.id).length;
              return (
                <TouchableOpacity
                  style={[styles.containerCard, { backgroundColor: cardBg, borderColor: isSelected ? PRIMARY : borderColor }, isSelected && styles.selectedCard]}
                  onPress={() => {
                    if (selectMode) { toggleSelect(entry); return; }
                    router.push({ pathname: '../container/[id]' as any, params: { id: c.id } });
                  }}
                  onLongPress={() => {
                    if (!selectMode) enterSelectMode(entry);
                    else toggleSelect(entry);
                  }}
                  activeOpacity={0.7}
                >
                  {selectMode ? (
                    <View style={[styles.selectCircle, isSelected && { backgroundColor: PRIMARY, borderColor: PRIMARY }]}>
                      {isSelected && <FontAwesomeIcon icon={faCheck} size={10} color="#fff" />}
                    </View>
                  ) : (
                    <View style={[styles.containerIcon, { backgroundColor: `${PRIMARY}15` }]}>
                      {c.photoUri
                        ? <Image source={{ uri: c.photoUri }} style={styles.containerThumb} />
                        : <FontAwesomeIcon icon={faFolder} size={16} color={PRIMARY} />
                      }
                    </View>
                  )}
                  <View style={styles.containerContent}>
                    <Text style={[styles.containerName, { color: colors.text }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={[styles.containerMeta, { color: subtleText }]}>
                      {count} {count === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  {!selectMode && <FontAwesomeIcon icon={faChevronRight} size={16} color={subtleText} />}
                </TouchableOpacity>
              );
            }
            const item = entry.data;
            const activeLending = activeLendingMap[item.id];
            const isLent = !!activeLending;
            const isOutside = activeOutsideItemIds.has(item.id);
            const isLost = !!item.lostAt;
            return (
              <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: cardBg, borderColor: isSelected ? PRIMARY : (isLost ? '#d32f2f55' : isOutside ? '#e67e2240' : isLent ? `${LENDING}40` : borderColor) }, isSelected && styles.selectedCard]}
                onPress={() => {
                  if (selectMode) { toggleSelect(entry); return; }
                  router.push({ pathname: '../item/[id]' as any, params: { id: item.id } });
                }}
                onLongPress={() => {
                  if (!selectMode) enterSelectMode(entry);
                  else toggleSelect(entry);
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
                  <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  {isLent && (
                    <Text style={[styles.itemLentMeta, { color: LENDING }]} numberOfLines={1}>
                      Lent to {activeLending.borrower_name}
                    </Text>
                  )}
                  {isLost && (
                    <Text style={[styles.itemLentMeta, { color: '#d32f2f' }]} numberOfLines={1}>
                      Reported lost
                    </Text>
                  )}
                  {isOutside && !isLent && !isLost && (
                    <Text style={[styles.itemLentMeta, { color: '#e67e22' }]} numberOfLines={1}>
                      In outside session
                    </Text>
                  )}
                </View>
                {isLost && (
                  <View style={[styles.lentBadge, { backgroundColor: '#d32f2f18' }]}>
                    <Text style={[styles.lentBadgeText, { color: '#d32f2f' }]}>Lost</Text>
                  </View>
                )}
                {!isLost && isOutside && (
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
      {!selectMode && (
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
              {allSpaces.map((s) => {
                const movingItems = items.filter(i => selectedMoveItemIds.has(i.id));
                const isCurrentSpace = s.id === id;
                const spaceContainerList = spaceContainers[s.id] ?? [];
                const isRootCurrent = isCurrentSpace && movingItems.length > 0 && movingItems.every(i => !i.containerId);
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
                      const isContainerCurrent = movingItems.length > 0 && movingItems.every(i => i.containerId === c.id);
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

      <ItemFormModal visible={showAddItemModal} onClose={() => setShowAddItemModal(false)} onSubmit={handleAddItem} contextLabel={space?.name} />
      <ContainerFormModal visible={showAddContainerModal} onClose={() => setShowAddContainerModal(false)} onSubmit={handleAddContainer} />
      <LendingFormModal
        visible={showLendModal}
        item={selectedLendItem}
        borrowerName={borrowerName}
        onBorrowerNameChange={setBorrowerName}
        note={lendNote}
        onNoteChange={setLendNote}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        onSubmit={handleLendSubmit}
        onCancel={() => { setShowLendModal(false); setBorrowerName(''); setLendNote(''); setDueDate(null); setSelectedLendItem(null); }}
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
          const isLost = !!item.lostAt;
          const outsideGuard = () =>
            Alert.alert(
              'Item is Outside',
              'This item is in an active outside session. Complete or remove it from the session before moving or lending it.'
            );
          const lostGuard = () =>
            Alert.alert(
              'Item is Lost',
              'Mark this item as found before moving or lending it.'
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
              description: isLost ? 'Item is marked lost' : isOutside ? 'In active outside session' : isLent ? 'Item is currently lent out' : 'Move to another space or container',
              onPress: isLost ? lostGuard : isOutside ? outsideGuard : isLent ? lendingGuard : () => openMoveModal(new Set([item.id])),
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
                  onPress: isLost ? lostGuard : isOutside ? outsideGuard : () => { setSelectedLendItem(item); setBorrowerName(''); setLendNote(''); setDueDate(null); setShowLendModal(true); },
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
              onPress: () => { setSelectedMoveContainer(c); setSelectedMoveContainerIds(new Set()); setShowMoveContainerModal(true); },
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
      <Modal visible={showMoveContainerModal} transparent animationType="slide" onRequestClose={closeMoveContainerModal}>
        <TouchableWithoutFeedback onPress={closeMoveContainerModal}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.moveSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
                <Text style={[styles.moveSheetTitle, { color: colors.text }]}>
                  Move {selectedMoveContainerIds.size > 1 ? `${selectedMoveContainerIds.size} Containers` : 'Container'}
                </Text>
                <Text style={[styles.moveSheetSubtitle, { color: subtleText }]}>
                  {selectedMoveContainer
                    ? `Move "${selectedMoveContainer.name}" to another space`
                    : 'Move selected containers to another space'}
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
                <TouchableOpacity style={[styles.moveCancelBtn, { borderColor }]} onPress={closeMoveContainerModal}>
                  <Text style={[styles.moveCancelText, { color: subtleText }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <PhotoPickerSheet
        visible={showSpacePhotoPicker}
        onClose={() => setShowSpacePhotoPicker(false)}
        onCamera={() => handleSpacePhoto('camera')}
        onGallery={() => handleSpacePhoto('gallery')}
      />
      <PhotoActionSheet
        visible={showSpacePhotoActions}
        title={space?.name ?? 'Space photo'}
        onView={() => setShowSpacePhotoViewer(true)}
        onReplace={() => setShowSpacePhotoPicker(true)}
        onRemove={handleRemoveSpacePhoto}
        onClose={() => setShowSpacePhotoActions(false)}
      />
      <PhotoViewModal
        visible={showSpacePhotoViewer}
        uri={space?.photoUri ?? null}
        title={space?.name ?? 'Space photo'}
        onClose={() => setShowSpacePhotoViewer(false)}
      />

      {/* Sort Sheet */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetTitleWrap}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>Sort Contents</Text>
                    <Text style={[styles.sheetSubtitle, { color: subtleText }]} numberOfLines={1}>
                      Containers and items, {sortLabel}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowMenu(false)} style={styles.sheetCloseBtn} accessibilityLabel="Close sort">
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
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.menuOption, sortMode === opt.key && styles.menuOptionActive]}
                    onPress={() => switchSortMode(opt.key)}
                    activeOpacity={0.7}
                  >
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

      {/* Space Actions */}
      <Modal visible={showSpaceMenu} transparent animationType="fade" onRequestClose={() => setShowSpaceMenu(false)}>
        <TouchableWithoutFeedback onPress={() => setShowSpaceMenu(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetTitleWrap}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>Space Actions</Text>
                    <Text style={[styles.sheetSubtitle, { color: subtleText }]} numberOfLines={1}>
                      {space?.name ?? 'Space'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowSpaceMenu(false)} style={styles.sheetCloseBtn} accessibilityLabel="Close space actions">
                    <FontAwesomeIcon icon={faTimes} size={16} color={subtleText} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => { setShowSpaceMenu(false); setEditingSpace(space); }}
                  activeOpacity={0.7}
                >
                  <FontAwesomeIcon icon={faPen} size={14} color={PRIMARY} />
                  <Text style={[styles.menuOptionText, { color: colors.text }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => { setShowSpaceMenu(false); handleDeleteSpace(); }}
                  activeOpacity={0.7}
                >
                  <FontAwesomeIcon icon={faTrash} size={14} color="#e53e3e" />
                  <Text style={[styles.menuOptionText, { color: '#e53e3e' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Bulk action toolbar */}
      {selectMode && (() => {
        const selIds = [...selectedIds];
        const selItemIds = selIds.filter((sid) => items.some((i) => i.id === sid));
        const selContainerIds = selIds.filter((sid) => containers.some((c) => c.id === sid));
        const onlyOneItem = selItemIds.length === 1 && selContainerIds.length === 0;
    const canEdit = selectedIds.size === 1; // Can edit either one item or one container
        // Can move multiple items if none are lent or outside
        const hasOnlyItems = selItemIds.length > 0 && selContainerIds.length === 0;
        const hasOnlyContainers = selContainerIds.length > 0 && selItemIds.length === 0;
        let canMove = hasOnlyItems || hasOnlyContainers;
        if (hasOnlyItems) {
          for (const itemId of selItemIds) {
            if (activeOutsideItemIds.has(itemId) || activeLendingMap[itemId] || items.find((i) => i.id === itemId)?.lostAt) {
              canMove = false;
              break;
            }
          }
        } else if (hasOnlyContainers) {
          canMove = getBlockedContainerItems(selContainerIds).length === 0;
        }
        const canDelete = selectedIds.size > 0;

        // Logic for Lend/Return button
        let lendActionLabel = 'Lend';
        let lendActionIcon = faHandshake;
        let lendActionColor = LENDING;
        let lendActionOnPress = handleBulkLend;
        let lendActionDisabled = true;

        if (onlyOneItem) {
          const selectedItem = items.find((i) => i.id === selItemIds[0]);
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
            } else if (isOutside || isLost) {
              lendActionDisabled = true; // Cannot lend if outside or lost
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
        initialPhotoUri={editingItem?.photoUri}
      />
      <ContainerFormModal
        visible={editingContainer !== null}
        onClose={() => setEditingContainer(null)}
        onSubmit={handleEditContainerSubmit}
        editMode
        initialName={editingContainer?.name}
        initialPhotoUri={editingContainer?.photoUri}
      />
      <SpaceFormModal
        visible={editingSpace !== null}
        onClose={() => setEditingSpace(null)}
        onSubmit={handleEditSpaceSubmit}
        editMode
        initialName={editingSpace?.name}
        initialPhotoUri={editingSpace?.photoUri}
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
  contentToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8, gap: 12 },
  contentControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewSegment: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  segmentIconBtn: {
    width: 32,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentIconBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  sortFilterButton: {
    height: 34,
    minWidth: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 6,
  },
  sortFilterText: { fontSize: 12, fontWeight: '700' },
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

  // 3-dot menu
  menuBtn: { paddingLeft: 12, paddingVertical: 8 },
  headerControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconToggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconToggleActive: { backgroundColor: 'rgba(107,127,153,0.12)' },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '78%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  sheetTitleWrap: { flex: 1 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  sheetSubtitle: { fontSize: 13, marginTop: 2 },
  sheetCloseBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  menuCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 180,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
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

  // Select mode
  selectCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c0c0c0', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  selectedCard: { borderWidth: 2 },
  gridSelectBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c0c0c0', backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  bulkToolbar: { position: 'absolute', left: 20, right: 20, borderRadius: 16, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-around', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
  bulkAction: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12, gap: 4, minWidth: 50 },
  bulkActionLabel: { fontSize: 11, fontWeight: '600' },
});

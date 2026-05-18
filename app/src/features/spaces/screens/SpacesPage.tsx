/**
 * SpacesPage
 *
 * Main Spaces tab -- minimalist redesign uniform with Outside feature
 */

import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
  DeviceEventEmitter,
  Image,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ItemActionSheet from './components/ItemActionSheet';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMagnifyingGlass, faTimes, faChevronRight, faFolder, faFileAlt, faFileArchive, faTrash, faPen, faList, faGrip, faArrowDownAZ, faArrowDownZA, faCubes, faCalendarPlus, faCalendar, faFilter, faCheck } from '@fortawesome/free-solid-svg-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useScrollHide } from '@/hooks/use-scroll-hide';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import type { Space, SpaceWithCount } from '@/src/models/Space';
import { SpaceService } from '@/src/services/SpaceService';
import { SpaceRepository } from '@/src/repositories/SpaceRepository';
import { PhotoService } from '@/src/services/PhotoService';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { ContainerRepository } from '@/src/repositories/ContainerRepository';
import SpaceFormModal from './components/SpaceFormModal';
import WalkthroughOverlay from '@/src/features/walkthrough/components/WalkthroughOverlay';
import { SPACES_WALKTHROUGH_STEPS, type SpotlightRect } from '@/src/features/walkthrough/models/WalkthroughStep';
import { WalkthroughService } from '@/src/features/walkthrough/services/WalkthroughService';

interface SearchResult {
  type: 'item' | 'container';
  id: string;
  name: string;
  spaceName: string;
  spaceId: string;
  containerName: string | null;
  containerId: string | null;
}

type SectionedSearchItem =
  | { kind: 'section'; title: string }
  | { kind: 'space'; data: Space }
  | { kind: 'result'; data: SearchResult };

const PRIMARY = '#6b7f99';
const VIEW_MODE_KEY = 'synop:spaces-view-mode';
const SORT_KEY = 'synop:spaces-sort';
const FILTER_KEY = 'synop:spaces-filter';
type ViewMode = 'list' | 'grid';
type SortMode = 'name-asc' | 'name-desc' | 'most-items' | 'newest' | 'oldest';
type FilterMode = 'all' | 'non-empty';
const GRID_GAP = 10;
const GRID_PADDING = 16;
const GRID_COLUMNS = 2;

export default function SpacesPage() {
  const { width: screenWidth } = useWindowDimensions();
  const GRID_ITEM_WIDTH = (screenWidth - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const router = useRouter();
  const { openCreate } = useLocalSearchParams<{ openCreate?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const { handleScroll } = useScrollHide();
  const tabBarPadding = useTabBarPadding();

  const [spaces, setSpaces] = useState<SpaceWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [actionSheetSpace, setActionSheetSpace] = useState<SpaceWithCount | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortMode, setSortMode] = useState<SortMode>('name-asc');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showMenu, setShowMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [editingSpace, setEditingSpace] = useState<SpaceWithCount | null>(null);
  const formVisibleRef = useRef(false);
  const spacesSearchRef = useRef<View>(null);
  const firstSpaceCardRef = useRef<View>(null);
  const spacesViewRef = useRef<View>(null);
  const spacesSortRef = useRef<View>(null);
  const [spacesWalkthroughVisible, setSpacesWalkthroughVisible] = useState(false);
  const [spacesWalkthroughIndex, setSpacesWalkthroughIndex] = useState(0);
  const [spacesSpotlightRect, setSpacesSpotlightRect] = useState<SpotlightRect | null>(null);

  const openCreateSpaceForm = useCallback(() => {
    setEditingSpace(null);
    setFormVisible((current) => {
      if (current || formVisibleRef.current) return current;
      formVisibleRef.current = true;
      return true;
    });
  }, []);

  // Load persisted preferences
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(VIEW_MODE_KEY),
      AsyncStorage.getItem(SORT_KEY),
      AsyncStorage.getItem(FILTER_KEY),
    ]).then(([v, s, f]) => {
      if (v === 'list' || v === 'grid') setViewMode(v);
      if (s === 'name-asc' || s === 'name-desc' || s === 'most-items' || s === 'newest' || s === 'oldest') setSortMode(s);
      if (f === 'all' || f === 'non-empty') setFilterMode(f);
    }).catch(() => {});
  }, []);

  // Listen only while this Spaces screen is focused. Restarting the walkthrough can
  // leave an older tabs tree mounted underneath; this prevents background listeners
  // from opening duplicate add-space sheets.
  useFocusEffect(
    useCallback(() => {
      const sub = DeviceEventEmitter.addListener('synop:open-add-space', () => {
        openCreateSpaceForm();
      });
      return () => sub.remove();
    }, [openCreateSpaceForm])
  );

  // Auto-open New Space when another screen navigates to this tab with openCreate=1.
  useFocusEffect(
    useCallback(() => {
      if (openCreate !== '1') return;

      const timer = setTimeout(() => {
        openCreateSpaceForm();
        router.setParams({ openCreate: '' } as any);
      }, 0);

      return () => clearTimeout(timer);
    }, [openCreate, openCreateSpaceForm, router])
  );

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SectionedSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const isSearching = searchText.trim().length > 0;
  const searchInputRef = useRef<TextInput>(null);
  const totalSearchResults = useMemo(
    () => searchResults.filter((i) => i.kind !== 'section').length,
    [searchResults]
  );

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  const measureSpacesStep = async (index: number): Promise<SpotlightRect | null> => {
    const step = SPACES_WALKTHROUGH_STEPS[index];
    if (!step) return null;
    const refMap: Record<string, React.RefObject<View | null>> = {
      'spaces-search': spacesSearchRef,
      'spaces-first-card': firstSpaceCardRef,
      'spaces-view-toggle': spacesViewRef,
      'spaces-sort-filter': spacesSortRef,
    };
    const ref = refMap[step.targetRef];
    if (!ref?.current) return null;

    return new Promise<SpotlightRect>((resolve, reject) => {
      ref.current?.measure((_x, _y, width, height, pageX, pageY) => {
        resolve({ x: pageX, y: pageY, width, height });
      }) ?? reject(new Error('walkthrough ref not found'));
    }).catch(() => null);
  };

  const startSpacesWalkthrough = async () => {
    DeviceEventEmitter.emit('synop:hide-tab-bar');
    const rect = await measureSpacesStep(0);
    setSpacesSpotlightRect(rect);
    setSpacesWalkthroughIndex(0);
    setSpacesWalkthroughVisible(true);
  };

  const finishSpacesWalkthrough = async () => {
    await WalkthroughService.markSpacesDone();
    setSpacesWalkthroughVisible(false);
    DeviceEventEmitter.emit('synop:show-tab-bar');
  };

  const handleSpacesWalkthroughNext = async () => {
    const nextIndex = spacesWalkthroughIndex + 1;
    if (nextIndex >= SPACES_WALKTHROUGH_STEPS.length) {
      await finishSpacesWalkthrough();
      return;
    }

    const rect = await measureSpacesStep(nextIndex);
    setSpacesSpotlightRect(rect);
    setSpacesWalkthroughIndex(nextIndex);
  };

  useFocusEffect(
    useCallback(() => {
      loadSpaces();
    }, [])
  );

  // Restore tab bar if navigating away while in select mode
  const selectModeRef = useRef(false);
  selectModeRef.current = selectMode;
  useEffect(() => {
    return () => {
      if (selectModeRef.current) {
        DeviceEventEmitter.emit('synop:show-tab-bar');
      }
      if (spacesWalkthroughVisible) {
        DeviceEventEmitter.emit('synop:show-tab-bar');
      }
    };
  }, [spacesWalkthroughVisible]);

  // Listen for refresh events from voice feature or other sources
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('synop:refresh-home', loadSpaces);
    return () => subscription.remove();
  }, []);

  // Handle back button — cancel select mode instead of navigating away
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectModeRef.current) {
        exitSelectMode();
        return true; // Prevent default navigation
      }
      return false; // Allow default navigation
    });
    return () => backHandler.remove();
  }, []);

  const loadSpaces = async () => {
    setLoading(true);
    try {
      const result = await SpaceService.getAllSpacesWithCounts();
      setSpaces(result);
    } catch (err) {
      console.error('[SpacesPage] Error loading spaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    const trimmed = text.trim();
    if (!trimmed) { setSearchResults([]); return; }

    // Debounce: cancel previous pending search
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performSearch(trimmed), 300);
  }, []);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (trimmed: string) => {
    setSearchLoading(true);
    try {
      const itemRepo = new ItemRepository();
      const [allItems, allSpaces] = await Promise.all([
        itemRepo.getAll(),
        SpaceService.getAllSpaces(),
      ]);
      const spaceMap = Object.fromEntries(allSpaces.map((s) => [s.id, s.name]));
      const lower = trimmed.toLowerCase();

      // Match spaces
      const spaceMatches = allSpaces.filter((s) => s.name.toLowerCase().includes(lower));

      // Match items
      const itemMatches: SearchResult[] = allItems
        .filter((i: any) => i.name.toLowerCase().includes(lower))
        .map((i: any) => ({
          type: 'item' as const,
          id: i.id,
          name: i.name,
          spaceName: i.space?.name ?? spaceMap[i.spaceId] ?? '',
          spaceId: i.spaceId,
          containerName: i.container?.name ?? null,
          containerId: i.containerId ?? null,
        }));

      // Match containers
      const containerRows = await Promise.all(
        allSpaces.map((s) =>
          ContainerRepository.getContainersBySpaceId(s.id).then((cs) =>
            cs.map((c) => ({ ...c, spaceName: s.name }))
          ).catch(() => [])
        )
      );
      const containerMatches: SearchResult[] = containerRows
        .flat()
        .filter((c: any) => c.name.toLowerCase().includes(lower))
        .map((c: any) => ({
          type: 'container' as const,
          id: c.id,
          name: c.name,
          spaceName: c.spaceName,
          spaceId: c.spaceId,
          containerName: null,
          containerId: null,
        }));

      // Build sectioned list
      const sections: SectionedSearchItem[] = [];
      if (spaceMatches.length > 0) {
        sections.push({ kind: 'section', title: 'Spaces' });
        spaceMatches.forEach((s) => sections.push({ kind: 'space', data: s }));
      }
      if (containerMatches.length > 0) {
        sections.push({ kind: 'section', title: 'Containers' });
        containerMatches.forEach((c) => sections.push({ kind: 'result', data: c }));
      }
      if (itemMatches.length > 0) {
        sections.push({ kind: 'section', title: 'Items' });
        itemMatches.forEach((i) => sections.push({ kind: 'result', data: i }));
      }
      setSearchResults(sections);
    } catch (err) {
      console.error('[SpacesPage] Search error:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const enterSelectMode = (space: SpaceWithCount) => {
    setSelectMode(true);
    setSelectedIds(new Set([space.id]));
    DeviceEventEmitter.emit('synop:hide-tab-bar');
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    DeviceEventEmitter.emit('synop:show-tab-bar');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(displayedSpaces.map((s) => s.id)));

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    Alert.alert(
      `Delete ${count} Space${count !== 1 ? 's' : ''}`,
      `This will permanently delete ${count} space${count !== 1 ? 's' : ''} and all their contents. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await Promise.all([...selectedIds].map((id) => SpaceService.deleteSpace(id)));
              exitSelectMode();
              await loadSpaces();
            } catch {
              Alert.alert('Error', 'Some spaces could not be deleted');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleCreateSpace = async (name: string, photoUri?: string | null) => {
    const shouldShowSpacesGuide = spaces.length === 0 && !(await WalkthroughService.isSpacesDone());
    const space = await SpaceService.createSpace(name);
    if (photoUri && space) {
      const savedUri = await PhotoService.savePhoto(photoUri, `space_${space.id}`);
      await SpaceRepository.updatePhotoUri(space.id, savedUri);
    }
    await loadSpaces();
    if (shouldShowSpacesGuide) {
      setTimeout(() => {
        startSpacesWalkthrough();
      }, 500);
    }
  };

  const handleEditSpace = async (name: string, photoUri?: string | null) => {
    if (!editingSpace) return;
    const id = editingSpace.id;
    await SpaceRepository.updateName(id, name);
    if (photoUri && photoUri !== editingSpace.photoUri) {
      const savedUri = await PhotoService.savePhoto(photoUri, `space_${id}`);
      await SpaceRepository.updatePhotoUri(id, savedUri);
    } else if (!photoUri && editingSpace.photoUri) {
      await PhotoService.deletePhoto(editingSpace.photoUri);
      await SpaceRepository.updatePhotoUri(id, null);
    }
    setEditingSpace(null);
    exitSelectMode();
    await loadSpaces();
  };

  const handleBulkEdit = () => {
    if (selectedIds.size !== 1) return;
    const id = [...selectedIds][0];
    const space = spaces.find((s) => s.id === id);
    if (space) setEditingSpace(space);
  };

  const confirmDeleteSpace = (space: SpaceWithCount) => {
    const parts: string[] = [];
    if (space.containerCount > 0) parts.push(`${space.containerCount} container${space.containerCount !== 1 ? 's' : ''}`);
    if (space.itemCount > 0) parts.push(`${space.itemCount} item${space.itemCount !== 1 ? 's' : ''}`);
    const msg = parts.length > 0
      ? `Delete "${space.name}" and its ${parts.join(' and ')}? This cannot be undone.`
      : `Delete "${space.name}"? This cannot be undone.`;
    Alert.alert('Delete Space', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await SpaceService.deleteSpace(space.id);
            await loadSpaces();
          } catch {
            Alert.alert('Error', 'Failed to delete space');
          }
        },
      },
    ]);
  };

  const switchViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setShowMenu(false);
    AsyncStorage.setItem(VIEW_MODE_KEY, mode).catch(() => {});
  };

  const switchSortMode = (mode: SortMode) => {
    setSortMode(mode);
    setShowMenu(false);
    AsyncStorage.setItem(SORT_KEY, mode).catch(() => {});
  };

  const switchFilterMode = (mode: FilterMode) => {
    setFilterMode(mode);
    setShowMenu(false);
    AsyncStorage.setItem(FILTER_KEY, mode).catch(() => {});
  };

  const sortLabel =
    sortMode === 'name-asc' ? 'A-Z' :
    sortMode === 'name-desc' ? 'Z-A' :
    sortMode === 'most-items' ? 'Most' :
    sortMode === 'newest' ? 'Newest' :
    'Oldest';

  const filterLabel = filterMode === 'non-empty' ? 'Non-empty' : 'All';

  const displayedSpaces = useMemo(() => {
    let result = [...spaces];

    // Filter
    if (filterMode === 'non-empty') {
      result = result.filter((s) => s.itemCount > 0 || s.containerCount > 0);
    }

    // Sort
    switch (sortMode) {
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'most-items':
        result.sort((a, b) => (b.itemCount + b.containerCount) - (a.itemCount + a.containerCount));
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
    }

    return result;
  }, [spaces, sortMode, filterMode]);

  const navigateToSearchResult = (result: SearchResult) => {
    if (result.type === 'container') {
      router.push({ pathname: '/container/[id]' as any, params: { id: result.id } });
      return;
    }

    if (result.containerId) {
      router.push({ pathname: '/container/[id]' as any, params: { id: result.containerId } });
      return;
    }

    router.push({ pathname: '/space/[id]' as any, params: { id: result.spaceId } });
  };

  type GridSearchRow =
    | { kind: 'fullwidth'; item: SectionedSearchItem }
    | { kind: 'pair'; left: SectionedSearchItem; right: SectionedSearchItem | null };

  const preparedGridSearchData = useMemo<GridSearchRow[]>(() => {
    if (!isSearching || viewMode !== 'grid') return [];
    const rows: GridSearchRow[] = [];
    let pendingResult: SectionedSearchItem | null = null;
    for (const si of searchResults) {
      if (si.kind === 'section' || si.kind === 'space') {
        if (pendingResult) { rows.push({ kind: 'pair', left: pendingResult, right: null }); pendingResult = null; }
        rows.push({ kind: 'fullwidth', item: si });
      } else {
        if (pendingResult) { rows.push({ kind: 'pair', left: pendingResult, right: si }); pendingResult = null; }
        else pendingResult = si;
      }
    }
    if (pendingResult) rows.push({ kind: 'pair', left: pendingResult, right: null });
    return rows;
  }, [isSearching, viewMode, searchResults]);

  const renderGridSearchResult = (si: SectionedSearchItem) => {
    if (si.kind !== 'result') return null;
    const result = si.data;
    const isContainer = result.type === 'container';
    return (
      <TouchableOpacity
        style={[styles.gridCard, { backgroundColor: cardBg, borderColor, width: GRID_ITEM_WIDTH }]}
        onPress={() => navigateToSearchResult(result)}
        activeOpacity={0.7}
      >
        <View style={[styles.gridPhotoPlaceholder, { backgroundColor: `${PRIMARY}12`, height: GRID_ITEM_WIDTH * 0.7 }]}>
          <FontAwesomeIcon icon={isContainer ? faFolder : faFileAlt} size={28} color={PRIMARY} />
        </View>
        <View style={styles.gridContent}>
          <Text style={[styles.gridName, { color: colors.text }]} numberOfLines={1}>{result.name}</Text>
          <Text style={[styles.gridMeta, { color: subtleText }]} numberOfLines={1}>
            {isContainer ? result.spaceName : result.containerName ? `${result.spaceName} › ${result.containerName}` : result.spaceName}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSpace = ({ item, index }: { item: SpaceWithCount; index: number }) => {
    const metaParts: string[] = [];
    if (item.containerCount > 0) metaParts.push(`${item.containerCount} container${item.containerCount !== 1 ? 's' : ''}`);
    if (item.itemCount > 0) metaParts.push(`${item.itemCount} item${item.itemCount !== 1 ? 's' : ''}`);
    const meta = metaParts.length > 0 ? metaParts.join(' · ') : 'Empty';
    const isSelected = selectedIds.has(item.id);

    const handlePress = () => {
      if (selectMode) { toggleSelect(item.id); return; }
      router.push({ pathname: '/space/[id]' as any, params: { id: item.id } });
    };
    const handleLongPress = () => {
      if (!selectMode) enterSelectMode(item);
    };

    if (viewMode === 'grid' && !isSearching) {
      return (
        <TouchableOpacity
          ref={!isSearching && index === 0 ? firstSpaceCardRef : undefined}
          style={[styles.gridCard, { backgroundColor: cardBg, borderColor: isSelected ? PRIMARY : borderColor, width: GRID_ITEM_WIDTH }, isSelected && styles.selectedCard]}
          onPress={handlePress}
          onLongPress={handleLongPress}
          activeOpacity={0.7}
        >
          {item.photoUri ? (
            <Image source={{ uri: item.photoUri }} style={[styles.gridPhoto, { height: GRID_ITEM_WIDTH * 0.7 }]} />
          ) : (
            <View style={[styles.gridPhotoPlaceholder, { backgroundColor: `${PRIMARY}12`, height: GRID_ITEM_WIDTH * 0.7 }]}>
              <FontAwesomeIcon icon={faFolder} size={28} color={PRIMARY} />
            </View>
          )}
          {selectMode && (
            <View style={[styles.gridSelectBadge, isSelected && { backgroundColor: PRIMARY }]}>
              {isSelected && <FontAwesomeIcon icon={faCheck} size={10} color="#fff" />}
            </View>
          )}
          <View style={styles.gridContent}>
            <Text style={[styles.gridName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.gridMeta, { color: subtleText }]} numberOfLines={1}>{meta}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
    <TouchableOpacity
      ref={!isSearching && index === 0 ? firstSpaceCardRef : undefined}
      style={[styles.spaceCard, { backgroundColor: cardBg, borderColor: isSelected ? PRIMARY : borderColor }, isSelected && styles.selectedCard]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      {selectMode ? (
        <View style={[styles.selectCircle, isSelected && { backgroundColor: PRIMARY, borderColor: PRIMARY }]}>
          {isSelected && <FontAwesomeIcon icon={faCheck} size={10} color="#fff" />}
        </View>
      ) : (
        <View style={[styles.spaceDot, { backgroundColor: PRIMARY }]} />
      )}
      {item.photoUri ? (
        <Image source={{ uri: item.photoUri }} style={styles.spaceThumb} />
      ) : null}
      <View style={styles.spaceCardContent}>
        <Text style={[styles.spaceName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.spaceDate, { color: subtleText }]}>
          {meta}
        </Text>
      </View>
      {!selectMode && <FontAwesomeIcon icon={faChevronRight} size={16} color={subtleText} />}
    </TouchableOpacity>
  );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]} edges={['top']}>
      {/* Page header — outside FlatList to prevent remount on key change */}
      <View style={styles.headerFixed}>
        <View style={styles.header}>
          <View>
            {selectMode ? (
              <Text style={[styles.title, { color: colors.text }]}>{selectedIds.size} selected</Text>
            ) : (
              <>
                <Text style={[styles.title, { color: colors.text }]}>Spaces</Text>
                <Text style={[styles.subtitle, { color: subtleText }]}>Organize your belongings</Text>
              </>
            )}
          </View>
          {selectMode ? (
            <View style={styles.selectHeaderActions}>
              <TouchableOpacity onPress={selectAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.selectActionText, { color: PRIMARY }]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={exitSelectMode} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.selectActionText, { color: subtleText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            spaces.length > 0 && !isSearching && (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={[styles.addSpaceBtn, { backgroundColor: PRIMARY }]}
                  onPress={openCreateSpaceForm}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.addSpaceBtnText}>+ Add Space</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>

        {/* Search bar */}
        <View ref={spacesSearchRef} style={[styles.searchWrapper, { backgroundColor: isDark ? '#1c1c1e' : '#ffffff', borderColor }]}>
          <FontAwesomeIcon icon={faMagnifyingGlass} size={16} color={colors.text} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search items & containers across all spaces..."
            placeholderTextColor={subtleText}
            value={searchText}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {isSearching && (
            <TouchableOpacity 
              onPress={() => { setSearchText(''); setSearchResults([]); searchInputRef.current?.focus(); }} 
              style={styles.clearBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.6}
            >
              <FontAwesomeIcon icon={faTimes} size={16} color={subtleText} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search result summary OR spaces section label */}
        {isSearching ? (
          <View style={styles.resultHeader}>
            {searchLoading ? (
              <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 8 }} />
            ) : null}
            <Text style={[styles.sectionLabel, { color: subtleText }]}>
              {searchLoading ? 'Searching...' : `${totalSearchResults} result${totalSearchResults !== 1 ? 's' : ''} for "${searchText.trim()}"`}
            </Text>
          </View>
        ) : spaces.length > 0 ? (
          <View style={styles.sectionLabelRow}>
            <Text style={[styles.sectionLabel, { color: subtleText }]}>YOUR SPACES</Text>
            <View style={styles.contentControls}>
              <View ref={spacesViewRef} style={[styles.viewSegment, { backgroundColor: isDark ? '#1c1c1e' : '#eef0f3', borderColor }]}>
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
                ref={spacesSortRef}
                style={[styles.sortFilterButton, { backgroundColor: cardBg, borderColor }]}
                onPress={() => setShowMenu(true)}
                accessibilityLabel="Sort and filter"
              >
                <FontAwesomeIcon icon={faFilter} size={13} color={PRIMARY} />
                <Text style={[styles.sortFilterText, { color: colors.text }]}>{sortLabel}</Text>
                {filterMode !== 'all' && <View style={[styles.filterDot, { backgroundColor: PRIMARY }]} />}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>

      <FlatList
        data={(isSearching && viewMode === 'grid') ? preparedGridSearchData as any[] : (isSearching ? searchResults : displayedSpaces) as any[]}
        keyExtractor={(item: any, index: number) => {
          if (isSearching && viewMode === 'grid') {
            const row = item as GridSearchRow;
            if (row.kind === 'fullwidth') {
              const si = row.item;
              if (si.kind === 'section') return `section-${si.title}`;
              if (si.kind === 'space') return `space-${si.data.id}`;
              return `result-fw-${si.data.type}-${si.data.id}`;
            }
            return `pair-${index}`;
          }
          if (isSearching) {
            const si = item as SectionedSearchItem;
            if (si.kind === 'section') return `section-${si.title}`;
            if (si.kind === 'space') return `space-${si.data.id}`;
            return `result-${si.data.type}-${si.data.id}`;
          }
          return (item as Space).id;
        }}
        renderItem={(isSearching && viewMode === 'grid') ? ({ item }: any) => {
          const row = item as GridSearchRow;
          if (row.kind === 'fullwidth') {
            const si = row.item;
            if (si.kind === 'section') return <Text style={[styles.sectionHeader, { color: PRIMARY }]}>{si.title}</Text>;
            if (si.kind === 'space') return renderSpace({ item: si.data as SpaceWithCount, index: 0 });
            return null;
          }
          return (
            <View style={[styles.gridRow, { marginBottom: GRID_GAP }]}>
              {renderGridSearchResult(row.left)}
              {row.right ? renderGridSearchResult(row.right) : <View style={{ width: GRID_ITEM_WIDTH }} />}
            </View>
          );
        } : isSearching ? ({ item }: any) => {
          const si = item as SectionedSearchItem;
          if (si.kind === 'section') {
            return (
              <Text style={[styles.sectionHeader, { color: PRIMARY }]}>{si.title}</Text>
            );
          }
          if (si.kind === 'space') {
            return renderSpace({ item: si.data as SpaceWithCount, index: 0 });
          }
          const result = si.data;
          const isContainer = result.type === 'container';
          return (
            <TouchableOpacity
              style={[styles.resultCard, { backgroundColor: cardBg, borderColor }]}
              onPress={() => navigateToSearchResult(result)}
              activeOpacity={0.7}
            >
              <View style={[styles.resultIcon, { backgroundColor: isContainer ? `${PRIMARY}15` : `${isDark ? '#48484a' : '#e2e6ea'}` }]}>
                {isContainer ? (
                  <FontAwesomeIcon icon={faFolder} size={16} color={PRIMARY} />
                ) : (
                  <FontAwesomeIcon icon={faFileAlt} size={16} color={isDark ? '#8e8e93' : '#6b7f99'} />
                )}
              </View>
              <View style={styles.resultContent}>
                <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>{result.name}</Text>
                <Text style={[styles.resultMeta, { color: subtleText }]} numberOfLines={1}>
                  {isContainer ? `Container in ${result.spaceName}` : result.containerName ? `${result.spaceName} › ${result.containerName}` : result.spaceName}
                </Text>
              </View>
              <FontAwesomeIcon icon={faChevronRight} size={16} color={subtleText} />
            </TouchableOpacity>
          );
        } : renderSpace}
        key={isSearching ? (viewMode === 'grid' ? 'search-grid' : 'search-list') : (viewMode === 'grid' ? 'grid' : 'list')}
        numColumns={(!isSearching && viewMode === 'grid') ? GRID_COLUMNS : 1}
        columnWrapperStyle={(!isSearching && viewMode === 'grid') ? styles.gridRow : undefined}
        contentContainerStyle={[styles.listContent, { paddingTop: 8, paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
        onScroll={isSearching ? undefined : handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          isSearching ? (
            searchLoading ? null : (
              <View style={styles.emptySearch}>
                <Text style={[styles.emptySearchIcon]}>🔍</Text>
                <Text style={[styles.emptySearchText, { color: subtleText }]}>No items or containers found</Text>
              </View>
            )
          ) : loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
              <View style={[styles.emptyIconContainer, { backgroundColor: `${PRIMARY}12` }]}>
                <FontAwesomeIcon icon={faFileArchive} size={40} color={PRIMARY} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Spaces Yet</Text>
              <Text style={[styles.emptySubtitle, { color: subtleText }]}>
                Create a space to start organizing your belongings
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: PRIMARY }]}
                onPress={openCreateSpaceForm}
              >
                <Text style={styles.primaryButtonText}>+ Create Space</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      <SpaceFormModal
        visible={formVisible}
        onClose={() => {
          formVisibleRef.current = false;
          setFormVisible(false);
        }}
        onSubmit={handleCreateSpace}
      />

      <SpaceFormModal
        visible={editingSpace !== null}
        onClose={() => setEditingSpace(null)}
        onSubmit={handleEditSpace}
        editMode
        initialName={editingSpace?.name}
        initialPhotoUri={editingSpace?.photoUri}
      />

      {/* Bulk action toolbar — floats above tab bar */}
      {selectMode && (
        <View style={[styles.bulkToolbar, { backgroundColor: cardBg, borderColor, bottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.bulkAction, { opacity: selectedIds.size !== 1 ? 0.4 : 1 }]}
            onPress={handleBulkEdit}
            disabled={selectedIds.size !== 1}
          >
            <FontAwesomeIcon icon={faPen} size={18} color={PRIMARY} />
            <Text style={[styles.bulkActionLabel, { color: PRIMARY }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bulkAction, { opacity: selectedIds.size === 0 || deleting ? 0.4 : 1 }]}
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0 || deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#d32f2f" />
            ) : (
              <FontAwesomeIcon icon={faTrash} size={18} color="#d32f2f" />
            )}
            <Text style={[styles.bulkActionLabel, { color: '#d32f2f' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      <ItemActionSheet
        visible={actionSheetSpace !== null}
        itemName={actionSheetSpace?.name ?? ''}
        onClose={() => setActionSheetSpace(null)}
        actions={(() => {
          const s = actionSheetSpace;
          if (!s) return [];
          const parts: string[] = [];
          if (s.containerCount > 0) parts.push(`${s.containerCount} container${s.containerCount !== 1 ? 's' : ''}`);
          if (s.itemCount > 0) parts.push(`${s.itemCount} item${s.itemCount !== 1 ? 's' : ''}`);
          const description = parts.length > 0
            ? `Will delete ${parts.join(' and ')} inside`
            : 'Remove this empty space';
          return [
            {
              icon: faTrash,
              label: 'Delete',
              description,
              destructive: true,
              onPress: () => confirmDeleteSpace(s),
            },
          ];
        })()}
      />

      <WalkthroughOverlay
        visible={spacesWalkthroughVisible}
        step={SPACES_WALKTHROUGH_STEPS[spacesWalkthroughIndex] ?? null}
        spotlightRect={spacesSpotlightRect}
        currentIndex={spacesWalkthroughIndex}
        totalSteps={SPACES_WALKTHROUGH_STEPS.length}
        finalButtonLabel="Done"
        onNext={handleSpacesWalkthroughNext}
        onSkip={finishSpacesWalkthrough}
      />

      {/* Sort / Filter Sheet */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetTitleWrap}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>Sort & Filter</Text>
                    <Text style={[styles.sheetSubtitle, { color: subtleText }]} numberOfLines={1}>
                      {filterLabel} spaces, {sortLabel}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowMenu(false)} style={styles.sheetCloseBtn} accessibilityLabel="Close sort and filter">
                    <FontAwesomeIcon icon={faTimes} size={16} color={subtleText} />
                  </TouchableOpacity>
                </View>
                <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                <Text style={[styles.menuTitle, { color: subtleText }]}>Sort by</Text>
                {[
                  { key: 'name-asc' as SortMode, icon: faArrowDownAZ, label: 'Name A-Z' },
                  { key: 'name-desc' as SortMode, icon: faArrowDownZA, label: 'Name Z-A' },
                  { key: 'most-items' as SortMode, icon: faCubes, label: 'Most items' },
                  { key: 'newest' as SortMode, icon: faCalendarPlus, label: 'Newest first' },
                  { key: 'oldest' as SortMode, icon: faCalendar, label: 'Oldest first' },
                ].map((opt) => (
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

                <View style={[styles.menuDivider, { backgroundColor: borderColor }]} />

                <Text style={[styles.menuTitle, { color: subtleText }]}>Show</Text>
                {[
                  { key: 'all' as FilterMode, label: 'All spaces' },
                  { key: 'non-empty' as FilterMode, label: 'Non-empty only' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.menuOption, filterMode === opt.key && styles.menuOptionActive]}
                    onPress={() => switchFilterMode(opt.key)}
                    activeOpacity={0.7}
                  >
                    <FontAwesomeIcon icon={faFilter} size={14} color={filterMode === opt.key ? PRIMARY : subtleText} />
                    <Text style={[styles.menuOptionText, { color: filterMode === opt.key ? PRIMARY : colors.text }]}>{opt.label}</Text>
                    {filterMode === opt.key && <FontAwesomeIcon icon={faCheck} size={12} color={PRIMARY} style={styles.menuCheck} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16 },
  headerFixed: { paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingTop: 4,
  },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  countBadgeText: { fontSize: 14, fontWeight: '600' },
  menuBtn: { padding: 8, marginTop: 4 },
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
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  iconToggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconToggleActive: { backgroundColor: 'rgba(107,127,153,0.12)' },

  // Search
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  clearBtn: { padding: 4 },
  clearBtnText: { fontSize: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  sectionLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 },
  sectionHeader: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', paddingTop: 12, paddingBottom: 6 },

  // Search results
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconText: { fontSize: 18 },
  resultContent: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  resultMeta: { fontSize: 12 },

  emptySearch: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptySearchIcon: { fontSize: 36 },
  emptySearchText: { fontSize: 15 },
  spaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  spaceDot: { width: 8, height: 8, borderRadius: 4 },
  spaceThumb: { width: 44, height: 44, borderRadius: 8 },
  spaceCardContent: { flex: 1 },
  spaceName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  spaceDate: { fontSize: 12 },
  chevron: { fontSize: 16 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minHeight: 40 },
  addSpaceBtn: {
    height: 38,
    minWidth: 108,
    paddingHorizontal: 14,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSpaceBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Grid view
  gridRow: { gap: GRID_GAP },
  gridCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: GRID_GAP,
  },
  gridPhoto: { width: '100%', resizeMode: 'cover' },
  gridPhotoPlaceholder: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: { padding: 10 },
  gridName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  gridMeta: { fontSize: 11 },

  // 3-dot menu
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
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
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
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 0,
    marginBottom: 4,
  },
  menuOptionActive: { backgroundColor: 'rgba(107,127,153,0.1)' },
  menuOptionText: { fontSize: 14, fontWeight: '500', flex: 1 },
  menuCheck: { marginLeft: 'auto' },
  menuDivider: { height: 1, marginVertical: 6, marginHorizontal: 14 },

  // Multi-select
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#c0c0c0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectedCard: { borderWidth: 2 },
  gridSelectBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#c0c0c0',
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectHeaderActions: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 6 },
  selectActionText: { fontSize: 15, fontWeight: '600' },
  bulkToolbar: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  bulkAction: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 4,
    minWidth: 60,
  },
  bulkActionLabel: { fontSize: 11, fontWeight: '600' },
});

/**
 * Lending Page
 *
 * Main lending tab â€” minimalist redesign, uniform with Outside feature
 *
 * Feature: 009 - Lending Tracker
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  Animated,
  PanResponder,
  DeviceEventEmitter,
  Image,
  useWindowDimensions,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMagnifyingGlass, faTimes, faChevronRight, faHandshake, faPlus, faMapPin, faFolder, faEllipsisVertical, faArrowDownAZ, faArrowDownZA, faCalendarPlus, faCalendar, faCheck, faList, faGrip } from '@fortawesome/free-solid-svg-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useScrollHide } from '@/hooks/use-scroll-hide';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { LendingService } from '../services/LendingService';
import { LendingRepository } from '../repositories/LendingRepository';
import { ItemRepository } from '../../../repositories/ItemRepository';
import { Lending } from '../models/Lending';
import type { Item } from '../../../models/Item';
import LendingFormModal from './components/LendingFormModal';
import { OutsideSessionItemRepository } from '../../outside/repositories/OutsideSessionItemRepository';
import { ReminderService } from '../../../services/ReminderService';

const PRIMARY = '#6b7f99';
const SORT_KEY = 'spotly:lending-sort';
const VIEW_KEY = 'spotly:lending-view';
type SortMode = 'name-asc' | 'name-desc' | 'newest' | 'oldest';
type ViewMode = 'list' | 'grid';
const GRID_GAP = 10;
const GRID_PADDING = 16;
const GRID_COLUMNS = 2;

export default function LendingPage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const { handleScroll } = useScrollHide();
  const tabBarPadding = useTabBarPadding();

  const { width: screenWidth } = useWindowDimensions();
  const GRID_ITEM_WIDTH = (screenWidth - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const repositories = useMemo(() => ({
    lendingRepository: new LendingRepository(),
    itemRepository: new ItemRepository(),
    outsideSessionItemRepository: new OutsideSessionItemRepository(),
  }), []);

  const lendingService = useMemo(() =>
    new LendingService(repositories.lendingRepository, repositories.itemRepository),
    [repositories]
  );

  const [lendings, setLendings] = useState<(Lending & { itemName?: string; itemPhotoUri?: string | null })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    AsyncStorage.getItem(SORT_KEY).then((v) => {
      if (v === 'name-asc' || v === 'name-desc' || v === 'newest' || v === 'oldest') setSortMode(v);
    }).catch(() => {});
    AsyncStorage.getItem(VIEW_KEY).then((v) => {
      if (v === 'list' || v === 'grid') setViewMode(v);
    }).catch(() => {});
  }, []);

  // Lend from here — item picker + form
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [itemPickerSearch, setItemPickerSearch] = useState('');
  const [itemPickerLoading, setItemPickerLoading] = useState(false);
  const [selectedLendItem, setSelectedLendItem] = useState<Item | null>(null);
  const [showLendForm, setShowLendForm] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const [lendNote, setLendNote] = useState('');
  const [lendDueDate, setLendDueDate] = useState<Date | null>(null);
  const [lendLoading, setLendLoading] = useState(false);

  const pickerTranslateY = useRef(new Animated.Value(0)).current;
  const pickerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => dy > 5,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) pickerTranslateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 80 || vy > 0.5) {
          Animated.timing(pickerTranslateY, { toValue: 600, duration: 200, useNativeDriver: true }).start(() => {
            setShowItemPicker(false);
            pickerTranslateY.setValue(0);
          });
        } else {
          Animated.spring(pickerTranslateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const closeItemPicker = useCallback(() => {
    pickerTranslateY.setValue(0);
    setShowItemPicker(false);
  }, [pickerTranslateY]);

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  const loadLendings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeLendings = await lendingService.getActiveLendings();
      const lendingsWithItems = await Promise.all(
        activeLendings.map(async (lending) => {
          try {
            const item = await repositories.itemRepository.getById(lending.item_id);
            return { ...lending, itemName: item?.name || 'Unknown Item', itemPhotoUri: item?.photoUri ?? null };
          } catch {
            return { ...lending, itemName: 'Unknown Item', itemPhotoUri: null };
          }
        })
      );
      setLendings(lendingsWithItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load lendings');
    } finally {
      setLoading(false);
    }
  }, [lendingService, repositories.itemRepository]);

  useFocusEffect(useCallback(() => { loadLendings(); }, [loadLendings]));

  // Listen for refresh events from voice feature or other sources
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('spotly:refresh-home', loadLendings);
    return () => subscription.remove();
  }, [loadLendings]);

  const openItemPicker = async () => {
    setItemPickerLoading(true);
    setItemPickerSearch('');
    setShowItemPicker(true);
    try {
      const [items, activeSessionItemIds] = await Promise.all([
        repositories.itemRepository.getAll(),
        repositories.outsideSessionItemRepository.getActiveSessionItemIds(),
      ]);
      const activeLentIds = new Set(lendings.map((l) => l.item_id));
      const activeOutsideIds = new Set(activeSessionItemIds);
      setAllItems(items.filter((i) => !activeLentIds.has(i.id) && !activeOutsideIds.has(i.id)));
    } catch {
      Alert.alert('Error', 'Failed to load items');
      setShowItemPicker(false);
    } finally {
      setItemPickerLoading(false);
    }
  };

  const handleSelectItem = (item: Item) => {
    setSelectedLendItem(item);
    setShowItemPicker(false);
    setBorrowerName('');
    setLendNote('');
    setLendDueDate(null);
    setShowLendForm(true);
  };

  const handleLendSubmit = async () => {
    if (!selectedLendItem || !borrowerName.trim()) return;
    setLendLoading(true);
    try {
      const created = await lendingService.createLending({
        item_id: selectedLendItem.id,
        borrower_name: borrowerName.trim(),
        note: lendNote.trim() || undefined,
        due_date: lendDueDate ?? undefined,
      });

      // Schedule reminders if due date was set
      if (lendDueDate) {
        try {
          const reminderId = await ReminderService.scheduleDueDateReminders(
            created.id,
            borrowerName.trim(),
            selectedLendItem.name,
            lendDueDate
          );
          if (reminderId) {
            await repositories.lendingRepository.setReminderId(created.id, reminderId);
          }
        } catch {
          // Non-fatal — lending still created
        }
      }

      setShowLendForm(false);
      setSelectedLendItem(null);
      setBorrowerName('');
      setLendNote('');
      setLendDueDate(null);
      await loadLendings();
      // Navigate to detail so user can add before photos immediately
      router.push(`/lending/${created.id}`);
    } catch (err: any) {
      Alert.alert('Error', err.code === 'DUPLICATE_ACTIVE_LENDING'
        ? 'This item is already lent out'
        : err.message || 'Failed to lend item');
    } finally {
      setLendLoading(false);
    }
  };

  const filteredPickerItems = useMemo(() => {
    const q = itemPickerSearch.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i as any).space?.name?.toLowerCase().includes(q) ||
        (i as any).container?.name?.toLowerCase().includes(q)
    );
  }, [allItems, itemPickerSearch]);

  const sortedLendings = useMemo(() => {
    const sorted = [...lendings];
    switch (sortMode) {
      case 'name-asc': sorted.sort((a, b) => (a.itemName ?? '').localeCompare(b.itemName ?? '')); break;
      case 'name-desc': sorted.sort((a, b) => (b.itemName ?? '').localeCompare(a.itemName ?? '')); break;
      case 'newest': sorted.sort((a, b) => new Date(b.lent_at).getTime() - new Date(a.lent_at).getTime()); break;
      case 'oldest': sorted.sort((a, b) => new Date(a.lent_at).getTime() - new Date(b.lent_at).getTime()); break;
    }
    return sorted;
  }, [lendings, sortMode]);

  const filteredLendings = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return sortedLendings;
    return sortedLendings.filter(
      (l) =>
        (l.itemName ?? '').toLowerCase().includes(q) ||
        l.borrower_name.toLowerCase().includes(q)
    );
  }, [sortedLendings, searchText]);

  const switchSortMode = (mode: SortMode) => {
    setSortMode(mode);
    setShowMenu(false);
    AsyncStorage.setItem(SORT_KEY, mode).catch(() => {});
  };

  const switchViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setShowMenu(false);
    AsyncStorage.setItem(VIEW_KEY, mode).catch(() => {});
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderLendingItem = ({ item, index }: { item: Lending & { itemName?: string; itemPhotoUri?: string | null }, index: number }) => {
    if (viewMode === 'grid') {
      return (
        <TouchableOpacity
          style={[styles.gridCard, { backgroundColor: cardBg, borderColor, width: GRID_ITEM_WIDTH }]}
          onPress={() => router.push(`/lending/${item.id}`)}
          activeOpacity={0.7}
        >
          {item.itemPhotoUri ? (
            <Image source={{ uri: item.itemPhotoUri }} style={[styles.gridPhoto, { height: GRID_ITEM_WIDTH * 0.7 }]} />
          ) : (
            <View style={[styles.gridPhotoPlaceholder, { backgroundColor: `${PRIMARY}12`, height: GRID_ITEM_WIDTH * 0.7 }]}>
              <FontAwesomeIcon icon={faHandshake} size={28} color={PRIMARY} />
            </View>
          )}
          <View style={styles.gridContent}>
            <Text style={[styles.gridBadge, { color: PRIMARY }]}>Lent</Text>
            <Text style={[styles.gridName, { color: colors.text }]} numberOfLines={1}>{item.itemName || 'Unknown Item'}</Text>
            <Text style={[styles.gridMeta, { color: subtleText }]} numberOfLines={1}>To {item.borrower_name}</Text>
            <Text style={[styles.gridDate, { color: subtleText }]}>{formatDate(item.lent_at)}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return (
    <TouchableOpacity
      style={[
        styles.lendingRow,
        index < filteredLendings.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
      ]}
      onPress={() => router.push(`/lending/${item.id}`)}
      activeOpacity={0.6}
    >
      {item.itemPhotoUri ? (
        <Image source={{ uri: item.itemPhotoUri }} style={styles.lendingThumb} />
      ) : (
        <View style={[styles.activeDot, { backgroundColor: PRIMARY }]} />
      )}
      <View style={styles.lendingRowContent}>
        <Text style={[styles.lendingItemName, { color: colors.text }]} numberOfLines={1}>
          {item.itemName || 'Unknown Item'}
        </Text>
        <Text style={[styles.lendingBorrower, { color: subtleText }]} numberOfLines={1}>
          Lent to {item.borrower_name}
        </Text>
        <Text style={[styles.lendingDate, { color: subtleText }]}>
          {formatDate(item.lent_at)}
        </Text>
      </View>
      <FontAwesomeIcon icon={faChevronRight} size={16} color={subtleText} />
    </TouchableOpacity>
  );};

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 8, paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Lending</Text>
            <Text style={[styles.subtitle, { color: subtleText }]}>{"Track items you've lent out"}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.historyPill, { borderColor, backgroundColor: cardBg }]}
              onPress={() => router.push('/lending/history')}
            >
              <Text style={[styles.historyPillText, { color: PRIMARY }]}>History</Text>
            </TouchableOpacity>
            {lendings.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowMenu(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <FontAwesomeIcon icon={faEllipsisVertical} size={18} color={subtleText} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : error ? (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.errorText, { color: '#d32f2f' }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: PRIMARY }]}
              onPress={loadLendings}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : lendings.length > 0 ? (
          <>
            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
              <View style={[styles.searchInputWrapper, { backgroundColor: isDark ? '#2c2c2e' : '#ffffff', borderColor }]}>
                <FontAwesomeIcon icon={faMagnifyingGlass} size={14} color={colors.text} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search items or borrowers..."
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

            {filteredLendings.length > 0 ? (
              <>
                <View style={styles.sectionLabelRow}>
                  <Text style={[styles.sectionLabel, { color: subtleText }]}>
                    ACTIVE{' '}
                    <Text style={styles.sectionLabelHint}>{'\u00B7'} {filteredLendings.length} item{filteredLendings.length !== 1 ? 's' : ''}</Text>
                  </Text>
                </View>
                {viewMode === 'grid' ? (
                  <FlatList
                    data={filteredLendings}
                    renderItem={renderLendingItem}
                    keyExtractor={(item) => item.id}
                    key="grid"
                    numColumns={GRID_COLUMNS}
                    columnWrapperStyle={styles.gridRow}
                    scrollEnabled={false}
                    contentContainerStyle={{ paddingBottom: 4 }}
                  />
                ) : (
                  <View style={[styles.card, { backgroundColor: cardBg, borderColor, padding: 0, overflow: 'hidden' }]}>
                    <FlatList
                      data={filteredLendings}
                      renderItem={renderLendingItem}
                      keyExtractor={(item) => item.id}
                      key="list"
                      scrollEnabled={false}
                      contentContainerStyle={{ paddingHorizontal: 16 }}
                    />
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.card, styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No results found</Text>
                <Text style={[styles.emptySubtitle, { color: subtleText }]}>Try a different item or borrower name</Text>
              </View>
            )}
          </>
        ) : (
          <View style={[styles.card, styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={[styles.emptyIconContainer, { backgroundColor: `${PRIMARY}12` }]}>
              <FontAwesomeIcon icon={faHandshake} size={36} color={PRIMARY} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Lendings</Text>
            <Text style={[styles.emptySubtitle, { color: subtleText }]}>
              Lend an item from any space to start tracking
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: PRIMARY, alignSelf: 'stretch' }]}
              onPress={openItemPicker}
            >
              <Text style={styles.primaryButtonText}>+ Choose an Item to Lend</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      {/* FAB — only shown when lendings exist */}
      {lendings.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: PRIMARY, bottom: insets.bottom + 84 }]}
          onPress={openItemPicker}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Item Picker Modal */}
      <Modal visible={showItemPicker} transparent animationType="slide" onRequestClose={closeItemPicker}>
        <TouchableWithoutFeedback onPress={closeItemPicker}>
          <View style={styles.pickerOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.pickerSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16, transform: [{ translateY: pickerTranslateY }] }]}>
                <View style={styles.handleArea} {...pickerPanResponder.panHandlers}>
                  <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
                </View>
                <Text style={[styles.pickerTitle, { color: colors.text }]}>Choose an Item to Lend</Text>
            {/* Search */}
            <View style={[styles.pickerSearchWrapper, { backgroundColor: isDark ? '#2c2c2e' : '#f8f9fa', borderColor }]}>
              <FontAwesomeIcon icon={faMagnifyingGlass} size={13} color={subtleText} />
              <TextInput
                style={[styles.pickerSearchInput, { color: colors.text }]}
                placeholder="Search items..."
                placeholderTextColor={subtleText}
                value={itemPickerSearch}
                onChangeText={setItemPickerSearch}
                autoFocus
              />
              {itemPickerSearch.length > 0 && (
                <TouchableOpacity onPress={() => setItemPickerSearch('')}>
                  <FontAwesomeIcon icon={faTimes} size={13} color={subtleText} />
                </TouchableOpacity>
              )}
            </View>
            {itemPickerLoading ? (
              <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 32 }} />
            ) : filteredPickerItems.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Text style={[styles.pickerEmptyText, { color: subtleText }]}>
                  {allItems.length === 0 ? 'No available items to lend' : 'No items match your search'}
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerList}>
                {filteredPickerItems.map((item) => {
                  const spaceName = (item as any).space?.name;
                  const containerName = (item as any).container?.name;
                  const locationLine = containerName ? `${spaceName} › ${containerName}` : spaceName;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.pickerRow, { borderColor }]}
                      onPress={() => handleSelectItem(item)}
                      activeOpacity={0.7}
                    >
                      {item.photoUri ? (
                        <Image source={{ uri: item.photoUri }} style={styles.pickerThumb} />
                      ) : (
                        <FontAwesomeIcon
                          icon={containerName ? faFolder : faMapPin}
                          size={15}
                          color={PRIMARY}
                        />
                      )}
                      <View style={styles.pickerRowText}>
                        <Text style={[styles.pickerItemName, { color: colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {locationLine && (
                          <Text style={[styles.pickerItemLocation, { color: subtleText }]} numberOfLines={1}>
                            {locationLine}
                          </Text>
                        )}
                      </View>
                      <FontAwesomeIcon icon={faChevronRight} size={13} color={subtleText} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
                <TouchableOpacity
                  style={[styles.pickerCancel, { borderColor }]}
                  onPress={closeItemPicker}
                >
                  <Text style={[styles.pickerCancelText, { color: subtleText }]}>Cancel</Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Lend Form Modal */}
      {/* Sort Menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuCard, { backgroundColor: cardBg, borderColor }]}>
                <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.menuTitle, { color: subtleText }]}>View</Text>
                  {([
                    { key: 'list' as ViewMode, icon: faList, label: 'List' },
                    { key: 'grid' as ViewMode, icon: faGrip, label: 'Grid' },
                  ] as { key: ViewMode; icon: any; label: string }[]).map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.menuOption, viewMode === opt.key && styles.menuOptionActive]}
                      onPress={() => switchViewMode(opt.key)}
                      activeOpacity={0.7}
                    >
                      <FontAwesomeIcon icon={opt.icon} size={14} color={viewMode === opt.key ? PRIMARY : subtleText} />
                      <Text style={[styles.menuOptionText, { color: viewMode === opt.key ? PRIMARY : colors.text }]}>{opt.label}</Text>
                      {viewMode === opt.key && <FontAwesomeIcon icon={faCheck} size={12} color={PRIMARY} style={styles.menuCheck} />}
                    </TouchableOpacity>
                  ))}

                  <View style={[styles.menuDivider, { backgroundColor: borderColor }]} />

                  <Text style={[styles.menuTitle, { color: subtleText }]}>Sort</Text>
                  {([
                    { key: 'name-asc' as SortMode, icon: faArrowDownAZ, label: 'Name A→Z' },
                    { key: 'name-desc' as SortMode, icon: faArrowDownZA, label: 'Name Z→A' },
                    { key: 'newest' as SortMode, icon: faCalendarPlus, label: 'Newest first' },
                    { key: 'oldest' as SortMode, icon: faCalendar, label: 'Oldest first' },
                  ] as { key: SortMode; icon: any; label: string }[]).map((opt) => (
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

      <LendingFormModal
        visible={showLendForm}
        item={selectedLendItem}
        borrowerName={borrowerName}
        onBorrowerNameChange={setBorrowerName}
        note={lendNote}
        onNoteChange={setLendNote}
        dueDate={lendDueDate}
        onDueDateChange={setLendDueDate}
        onSubmit={handleLendSubmit}
        onCancel={() => { setShowLendForm(false); setSelectedLendItem(null); setBorrowerName(''); setLendNote(''); setLendDueDate(null); }}
        loading={lendLoading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16 },

  searchContainer: { paddingHorizontal: 0, paddingBottom: 12 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, height: 44, gap: 8 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 15 },
  clearBtn: { padding: 4 },
  clearBtnText: { fontSize: 13, color: '#8e8e93' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  historyPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  historyPillText: { fontSize: 14, fontWeight: '600' },

  centerContainer: { justifyContent: 'center', alignItems: 'center', minHeight: 200 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: { fontSize: 12, fontWeight: '700' },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  sectionLabelHint: { fontSize: 11, fontStyle: 'italic', fontWeight: '400' },

  lendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  lendingThumb: { width: 40, height: 40, borderRadius: 8, flexShrink: 0 },
  lendingRowContent: { flex: 1 },
  lendingItemName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  lendingBorrower: { fontSize: 13, marginBottom: 2 },
  lendingDate: { fontSize: 12 },
  chevron: { fontSize: 22 },

  errorText: { fontSize: 15, marginBottom: 16, textAlign: 'center' },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  emptyCard: { alignItems: 'center', paddingVertical: 36, gap: 12, marginTop: 24 },
  emptyIconContainer: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 20,
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
    paddingVertical: 9,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  menuOptionActive: { backgroundColor: 'rgba(107,127,153,0.1)' },
  menuOptionText: { fontSize: 14, fontWeight: '500', flex: 1 },
  menuCheck: { marginLeft: 'auto' },
  menuDivider: { height: 1, marginVertical: 6, marginHorizontal: 14 },

  // Grid view
  gridRow: { gap: GRID_GAP },
  gridCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: GRID_GAP },
  gridPhoto: { width: '100%', resizeMode: 'cover' },
  gridPhotoPlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  gridContent: { padding: 10 },
  gridBadge: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  gridName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  gridMeta: { fontSize: 12, marginBottom: 1 },
  gridDate: { fontSize: 11 },

  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 0, maxHeight: '80%' },
  handleArea: { paddingVertical: 12, alignItems: 'center' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2 },
  pickerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 14 },
  pickerSearchWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 40, gap: 8, marginBottom: 12 },
  pickerSearchInput: { flex: 1, fontSize: 15 },
  pickerList: { marginBottom: 8 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  pickerThumb: { width: 36, height: 36, borderRadius: 8, flexShrink: 0 },
  pickerRowText: { flex: 1 },
  pickerItemName: { fontSize: 15, fontWeight: '500' },
  pickerItemLocation: { fontSize: 12, marginTop: 2 },
  pickerEmpty: { paddingVertical: 32, alignItems: 'center' },
  pickerEmptyText: { fontSize: 15 },
  pickerCancel: { marginTop: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  pickerCancelText: { fontSize: 15, fontWeight: '600' },
});


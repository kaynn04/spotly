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
import { LendingService } from '@/src/features/lending/services/LendingService';
import { LendingRepository } from '@/src/features/lending/repositories/LendingRepository';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { Lending } from '@/src/features/lending/models/Lending';
import ItemFormModal from '@/src/features/spaces/screens/components/ItemFormModal';
import ContainerFormModal from '@/src/features/spaces/screens/components/ContainerFormModal';
import LendingFormModal from '@/src/features/lending/screens/components/LendingFormModal';
import ItemActionSheet from '@/src/features/spaces/screens/components/ItemActionSheet';

const PRIMARY = '#6b7f99';

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
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedMoveItemId, setSelectedMoveItemId] = useState<string | null>(null);

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

  const lendingService = useMemo(
    () => new LendingService(new LendingRepository(), new ItemRepository()),
    []
  );

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  useEffect(() => { loadAll(); }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (id) { loadItems(); loadContainers(); loadActiveLendings(); }
    }, [id])
  );

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    try {
      setSpace(await SpaceService.getSpaceById(id));
      await Promise.all([loadItems(), loadContainers(), loadAllSpaces(), loadActiveLendings()]);
    } catch (err) {
      console.error('[SpaceDetailScreen] loadAll:', err);
    } finally {
      setLoading(false);
    }
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

  async function handleMoveToContainer(containerId: string) {
    if (!selectedMoveItemId || !id) return;
    try {
      await ItemService.moveItemToContainer(selectedMoveItemId, id, containerId);
      setShowMoveModal(false);
      setSelectedMoveItemId(null);
      await loadItems();
    } catch { Alert.alert('Error', 'Failed to move item'); }
  }

  async function handleMoveToSpace(targetSpaceId: string) {
    if (!selectedMoveItemId || !id) return;
    try {
      await ItemService.moveItem(selectedMoveItemId, id, targetSpaceId);
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

  async function handleAddItem(name: string, description?: string, quantity?: number) {
    await ItemService.createItem(id!, name, null, description, quantity);
    await loadItems();
  }

  async function handleAddContainer(name: string) {
    await ContainerService.createContainer(name, id!);
    await loadContainers();
    await loadItems();
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
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <>
          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
            <View style={[styles.searchInputWrapper, { backgroundColor: isDark ? '#2c2c2e' : '#ffffff', borderColor }]}>
              <FontAwesomeIcon icon={faMagnifyingGlass} size={14} color={isDark ? '#ffffff' : '#1c1c1e'} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? '#ffffff' : '#2c3e50' }]}
                placeholder="Search containers & items..."
                placeholderTextColor={isDark ? '#8e8e93' : '#a0aec0'}
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
                    ? `${filteredData.filter(e => e.type === 'container').length} container${filteredData.filter(e => e.type === 'container').length !== 1 ? 's' : ''} \u00B7 ${filteredData.filter(e => e.type === 'item').length} item${filteredData.filter(e => e.type === 'item').length !== 1 ? 's' : ''}`
                    : filterSegment === 'containers'
                    ? `${filteredData.length} container${filteredData.length !== 1 ? 's' : ''}`
                    : filterSegment === 'items'
                    ? `${filteredData.length} item${filteredData.length !== 1 ? 's' : ''}`
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
                    <FontAwesomeIcon icon={faFolder} size={16} color={PRIMARY} />
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
            return (
              <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: cardBg, borderColor: isLent ? `${PRIMARY}40` : borderColor }]}
                onPress={() => router.push({ pathname: '../item/[id]' as any, params: { id: item.id } })}
                onLongPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.itemDot, { backgroundColor: isLent ? PRIMARY : isDark ? '#48484a' : '#c7c7cc' }]} />
                <View style={styles.itemTextWrap}>
                  <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  {isLent && (
                    <Text style={[styles.itemLentMeta, { color: PRIMARY }]} numberOfLines={1}>
                      Lent to {activeLending.borrower_name}
                    </Text>
                  )}
                </View>
                {isLent ? (
                  <View style={[styles.lentBadge, { backgroundColor: `${PRIMARY}15` }]}>
                    <Text style={[styles.lentBadgeText, { color: PRIMARY }]}>Lent</Text>
                  </View>
                ) : (
                  <FontAwesomeIcon icon={faEllipsisVertical} size={14} color={subtleText} />
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
              {containers.length > 0 && (
                <>
                  <Text style={[styles.moveSectionLabel, { color: subtleText }]}>CONTAINERS IN THIS SPACE</Text>
                  {containers.map((c) => (
                    <TouchableOpacity key={c.id} style={[styles.moveOption, { borderColor }]} onPress={() => handleMoveToContainer(c.id)}>
                      <FontAwesomeIcon icon={faFolder} size={16} color={PRIMARY} />
                      <Text style={[styles.moveOptionText, { color: colors.text }]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {allSpaces.filter((s) => s.id !== id).length > 0 && (
                <>
                  <Text style={[styles.moveSectionLabel, { color: subtleText }]}>MOVE TO ANOTHER SPACE</Text>
                  {allSpaces.filter((s) => s.id !== id).map((s) => (
                    <TouchableOpacity key={s.id} style={[styles.moveOption, { borderColor }]} onPress={() => handleMoveToSpace(s.id)}>
                      <Text style={styles.moveOptionIcon}>{'\u{1F4CD}'}</Text>
                      <Text style={[styles.moveOptionText, { color: colors.text }]}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
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
        onClose={() => setActionSheetItem(null)}
        actions={(() => {
          const item = actionSheetItem;
          if (!item) return [];
          const lending = activeLendingMap[item.id];
          const isLent = !!lending;
          return [
            {
              icon: faBox,
              label: 'Move',
              description: 'Move to another space or container',
              onPress: () => { setSelectedMoveItemId(item.id); setShowMoveModal(true); },
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
                  description: 'Track who you lent this item to',
                  onPress: () => { setSelectedLendItem(item); setBorrowerName(''); setLendNote(''); setShowLendModal(true); },
                },
            {
              icon: faTrash,
              label: 'Delete',
              description: isLent ? 'Item is currently lent out' : 'Permanently remove this item',
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
  deleteBtnText: { fontSize: 15, color: '#d32f2f', fontWeight: '500' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 12 },
  containerCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8, gap: 12 },
  containerIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  containerIconText: { fontSize: 18 },
  containerContent: { flex: 1 },
  containerName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  containerMeta: { fontSize: 12 },
  chevron: { fontSize: 16 },
  itemCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 6, gap: 10 },
  itemDot: { width: 6, height: 6, borderRadius: 3 },
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
  moveOptionIcon: { fontSize: 16 },
  moveOptionText: { fontSize: 15, fontWeight: '500' },
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
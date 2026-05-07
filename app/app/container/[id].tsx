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

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft, faMapPin, faEllipsisVertical, faBox, faHandshake, faCheck, faTrash, faFolder, faRightLeft } from '@fortawesome/free-solid-svg-icons';
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
import ItemActionSheet from '@/src/features/spaces/screens/components/ItemActionSheet';
import LendingFormModal from '@/src/features/lending/screens/components/LendingFormModal';

const PRIMARY = '#6b7f99';

export default function ContainerDetailScreen() {
  const router = useRouter();
  const { id: containerId } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const [container, setContainer] = useState<Container | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedMoveItemId, setSelectedMoveItemId] = useState<string | null>(null);
  const [actionSheetItem, setActionSheetItem] = useState<Item | null>(null);
  const [showContainerMenu, setShowContainerMenu] = useState(false);
  const [showMoveContainerModal, setShowMoveContainerModal] = useState(false);
  const [spaceContainers, setSpaceContainers] = useState<Record<string, Container[]>>({});

  // Lending state
  const [showLendModal, setShowLendModal] = useState(false);
  const [selectedLendItem, setSelectedLendItem] = useState<Item | null>(null);
  const [borrowerName, setBorrowerName] = useState('');
  const [lendNote, setLendNote] = useState('');
  const [lendLoading, setLendLoading] = useState(false);
  const [activeLendingMap, setActiveLendingMap] = useState<Record<string, Lending>>({});

  const lendingService = useMemo(
    () => new LendingService(new LendingRepository(), new ItemRepository()),
    []
  );

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  useEffect(() => { loadContainer(); }, [containerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      if (container?.id) { loadItems(); loadAllSpaces(); loadActiveLendings(); }
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
      await loadActiveLendings();
    } catch (err: any) {
      Alert.alert('Error', err.code === 'DUPLICATE_ACTIVE_LENDING'
        ? 'This item is already lent out'
        : err.message || 'Failed to lend item');
    } finally {
      setLendLoading(false);
    }
  }

  function handleItemPress(item: Item) {
    setActionSheetItem(item);
  }

  function handleContainerMenuPress() {
    setShowContainerMenu(true);
  }

  async function handleMoveContainerToSpace(targetSpaceId: string) {
    if (!containerId) return;
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
    if (!selectedMoveItemId || !space) return;
    try {
      await ItemService.moveItemToContainer(selectedMoveItemId, space.id, '');
      setShowMoveModal(false);
      setSelectedMoveItemId(null);
      await loadItems();
    } catch { Alert.alert('Error', 'Failed to move item'); }
  }

  async function handleMoveToSpace(targetSpaceId: string) {
    if (!selectedMoveItemId || !space) return;
    try {
      await ItemService.moveItem(selectedMoveItemId, space.id, targetSpaceId);
      setShowMoveModal(false);
      setSelectedMoveItemId(null);
      await loadItems();
    } catch { Alert.alert('Error', 'Failed to move item'); }
  }

  async function handleMoveToContainer(targetSpaceId: string, targetContainerId: string) {
    if (!selectedMoveItemId) return;
    try {
      await ItemService.moveItemToContainer(selectedMoveItemId, targetSpaceId, targetContainerId);
      setShowMoveModal(false);
      setSelectedMoveItemId(null);
      await loadItems();
    } catch { Alert.alert('Error', 'Failed to move item'); }
  }

  async function handleAddItem(name: string, description?: string, quantity?: number) {
    if (!space || !containerId) return;
    await ItemService.createItem(space.id, name, containerId, description, quantity);
    await loadItems();
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: borderColor, paddingTop: insets.top, backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesomeIcon icon={faChevronLeft} size={16} color={PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {space && (
            <Text style={[styles.breadcrumb, { color: subtleText }]} numberOfLines={1}>
              {space.name}
            </Text>
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {container?.name ?? 'Container'}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerMenuBtn} onPress={handleContainerMenuPress}>
          <FontAwesomeIcon icon={faEllipsisVertical} size={18} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            items.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: subtleText }]}>
                {items.length} item{items.length !== 1 ? 's' : ''} {'·'} Hold to manage
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
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
                  <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {isLent && (
                    <Text style={[styles.itemLentMeta, { color: PRIMARY }]} numberOfLines={1}>
                      Lent to {activeLending.borrower_name}
                    </Text>
                  )}
                </View>
                {isLent && (
                  <View style={[styles.lentBadge, { backgroundColor: `${PRIMARY}15` }]}>
                    <Text style={[styles.lentBadgeText, { color: PRIMARY }]}>Lent</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.emptyText, { color: subtleText }]}>
                {'No items in this container yet.\nTap the button below to add one.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Bottom Action Bar */}
      <View style={[styles.actionBar, { backgroundColor: cardBg, borderTopColor: borderColor, paddingBottom: insets.bottom + 8 }]}>
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
        </View>
      </Modal>

      {/* Move Container Modal */}
      <Modal visible={showMoveContainerModal} transparent animationType="slide" onRequestClose={() => setShowMoveContainerModal(false)}>
        <View style={styles.sheetOverlay}>
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
        </View>
      </Modal>

      <ItemFormModal
        visible={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        onSubmit={handleAddItem}
        contextLabel={container?.name}
      />

      {/* Container action menu */}
      <Modal visible={showContainerMenu} transparent animationType="fade" onRequestClose={() => setShowContainerMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowContainerMenu(false)}>
          <View style={[styles.menuSheet, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.menuTitle, { color: subtleText }]}>{container?.name ?? 'Container'}</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowContainerMenu(false); setShowMoveContainerModal(true); }}
            >
              <FontAwesomeIcon icon={faRightLeft} size={16} color={PRIMARY} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Move to</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: borderColor }]} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowContainerMenu(false); confirmDeleteContainer(); }}
            >
              <FontAwesomeIcon icon={faTrash} size={16} color="#e53e3e" />
              <Text style={[styles.menuItemText, { color: '#e53e3e' }]}>Delete Container</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 60, paddingRight: 16 },
  menuSheet: { borderRadius: 14, borderWidth: 1, minWidth: 200, overflow: 'hidden' },
  menuTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuItemText: { fontSize: 15, fontWeight: '500' },
  menuDivider: { height: 1, marginHorizontal: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 12 },
  itemCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 6, gap: 10 },
  itemDot: { width: 6, height: 6, borderRadius: 3 },
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
});
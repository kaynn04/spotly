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
} from 'react-native';
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
import ItemFormModal from '@/src/features/spaces/screens/components/ItemFormModal';
import ContainerFormModal from '@/src/features/spaces/screens/components/ContainerFormModal';
import LendingFormModal from '@/src/features/lending/screens/components/LendingFormModal';

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
      if (id) { loadItems(); loadContainers(); }
    }, [id])
  );

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    try {
      setSpace(await SpaceService.getSpaceById(id));
      await Promise.all([loadItems(), loadContainers(), loadAllSpaces()]);
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

  function handleItemPress(item: Item) {
    Alert.alert(item.name, 'What do you want to do?', [
      { text: 'Move', onPress: () => { setSelectedMoveItemId(item.id); setShowMoveModal(true); } },
      {
        text: 'Lend',
        onPress: () => {
          setSelectedLendItem(item);
          setBorrowerName('');
          setLendNote('');
          setShowLendModal(true);
        },
      },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteItem(item.id, item.name) },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

  async function handleAddItem(name: string) {
    await ItemService.createItem(id!, name, null);
    await loadItems();
  }

  async function handleAddContainer(name: string) {
    await ContainerService.createContainer(name, id!);
    await loadContainers();
    await loadItems();
  }

  const spaceLevelItems = items.filter((item) => !item.containerId);
  const listData: ListEntry[] = [
    ...containers.map((c) => ({ type: 'container' as const, data: c })),
    ...spaceLevelItems.map((i) => ({ type: 'item' as const, data: i })),
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: borderColor, paddingTop: insets.top, backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: PRIMARY }]}>{'< Back'}</Text>
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
        <FlatList
          data={listData}
          keyExtractor={(entry) =>
            entry.type === 'container' ? `c-${entry.data.id}` : `i-${entry.data.id}`
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.sectionLabel, { color: subtleText }]}>
              {containers.length} container{containers.length !== 1 ? 's' : ''}{' '}
              {'\u00B7'} {spaceLevelItems.length} item{spaceLevelItems.length !== 1 ? 's' : ''} at root
            </Text>
          }
          renderItem={({ item: entry }) => {
            if (entry.type === 'container') {
              const c = entry.data;
              const count = items.filter((i) => i.containerId === c.id).length;
              return (
                <TouchableOpacity
                  style={[styles.containerCard, { backgroundColor: cardBg, borderColor }]}
                  onPress={() => router.push({ pathname: '../container/[id]' as any, params: { id: c.id } })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.containerIcon, { backgroundColor: `${PRIMARY}15` }]}>
                    <Text style={styles.containerIconText}>{'\u{1F4C1}'}</Text>
                  </View>
                  <View style={styles.containerContent}>
                    <Text style={[styles.containerName, { color: colors.text }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={[styles.containerMeta, { color: subtleText }]}>
                      {count} {count === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: subtleText }]}>{'>'}</Text>
                </TouchableOpacity>
              );
            }
            const item = entry.data;
            return (
              <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: cardBg, borderColor }]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.itemDot, { backgroundColor: isDark ? '#48484a' : '#c7c7cc' }]} />
                <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.itemMoreDots, { color: subtleText }]}>{'...'}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.emptyText, { color: subtleText }]}>
                {'No items or containers yet.\nUse the buttons below to get started.'}
              </Text>
            </View>
          }
        />
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
                      <Text style={styles.moveOptionIcon}>{'\u{1F4C1}'}</Text>
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
  itemName: { flex: 1, fontSize: 15, fontWeight: '500' },
  itemMoreDots: { fontSize: 14, letterSpacing: 1 },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 28, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  actionBarBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  actionBarBtnOutline: { borderWidth: 1.5 },
  actionBarBtnText: { fontSize: 15, fontWeight: '600' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  moveSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '70%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  moveSheetTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 16 },
  moveSectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  moveOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6, gap: 12 },
  moveOptionIcon: { fontSize: 16 },
  moveOptionText: { fontSize: 15, fontWeight: '500' },
  moveCancelBtn: { marginTop: 12, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  moveCancelText: { fontSize: 15, fontWeight: '600' },
});
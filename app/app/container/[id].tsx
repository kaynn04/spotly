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

import React, { useState, useEffect, useCallback } from 'react';
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
import ItemFormModal from '@/src/features/spaces/screens/components/ItemFormModal';
import ItemActionSheet from '@/src/features/spaces/screens/components/ItemActionSheet';

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

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  useEffect(() => { loadContainer(); }, [containerId]);

  useFocusEffect(
    useCallback(() => {
      if (container?.id) { loadItems(); loadAllSpaces(); }
    }, [container?.id])
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
    try { setAllSpaces(await SpaceService.getAllSpaces()); } catch {}
  }

  function handleItemPress(item: Item) {
    setActionSheetItem(item);
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

  async function handleAddItem(name: string) {
    if (!space || !containerId) return;
    await ItemService.createItem(space.id, name, containerId);
    await loadItems();
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: borderColor, paddingTop: insets.top, backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: PRIMARY }]}>{'< Back'}</Text>
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
        <View style={styles.itemCountBadge}>
          <Text style={[styles.itemCountText, { color: PRIMARY }]}>
            {items.length}
          </Text>
        </View>
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
                {items.length} item{items.length !== 1 ? 's' : ''} {'\u00B7'} Tap to manage
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.itemCard, { backgroundColor: cardBg, borderColor }]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.itemDot, { backgroundColor: isDark ? '#48484a' : '#c7c7cc' }]} />
              <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.itemMoreDots, { color: subtleText }]}>{'...'}</Text>
            </TouchableOpacity>
          )}
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
              {space && (
                <>
                  <Text style={[styles.moveSectionLabel, { color: subtleText }]}>IN THIS SPACE</Text>
                  <TouchableOpacity style={[styles.moveOption, { borderColor }]} onPress={handleMoveToRootSpace}>
                    <Text style={styles.moveOptionIcon}>{'\u{1F4CD}'}</Text>
                    <Text style={[styles.moveOptionText, { color: colors.text }]}>
                      Root of {space.name}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              {allSpaces.filter((s) => s.id !== space?.id).length > 0 && (
                <>
                  <Text style={[styles.moveSectionLabel, { color: subtleText }]}>MOVE TO ANOTHER SPACE</Text>
                  {allSpaces.filter((s) => s.id !== space?.id).map((s) => (
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

      <ItemFormModal
        visible={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        onSubmit={handleAddItem}
        contextLabel={container?.name}
      />
      <ItemActionSheet
        visible={actionSheetItem !== null}
        itemName={actionSheetItem?.name ?? ''}
        onClose={() => setActionSheetItem(null)}
        actions={[
          {
            icon: '📦',
            label: 'Move',
            description: 'Move to another space or container',
            onPress: () => { setSelectedMoveItemId(actionSheetItem!.id); setShowMoveModal(true); },
          },
          {
            icon: '🗑️',
            label: 'Delete',
            description: 'Permanently remove this item',
            destructive: true,
            onPress: () => confirmDeleteItem(actionSheetItem!.id, actionSheetItem!.name),
          },
        ]}
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
  itemCountBadge: { paddingLeft: 12, paddingVertical: 8 },
  itemCountText: { fontSize: 14, fontWeight: '700' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 12 },
  itemCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 6, gap: 10 },
  itemDot: { width: 6, height: 6, borderRadius: 3 },
  itemName: { flex: 1, fontSize: 15, fontWeight: '500' },
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
  moveOptionIcon: { fontSize: 16 },
  moveOptionText: { fontSize: 15, fontWeight: '500' },
  moveCancelBtn: { marginTop: 12, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  moveCancelText: { fontSize: 15, fontWeight: '600' },
});
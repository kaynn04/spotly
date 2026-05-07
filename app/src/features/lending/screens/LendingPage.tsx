/**
 * Lending Page
 *
 * Main lending tab â€” minimalist redesign, uniform with Outside feature
 *
 * Feature: 009 - Lending Tracker
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMagnifyingGlass, faTimes, faChevronRight, faHandshake, faPlus, faMapPin, faFolder } from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
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

const PRIMARY = '#6b7f99';

export default function LendingPage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const { handleScroll } = useScrollHide();
  const tabBarPadding = useTabBarPadding();

  const repositories = useMemo(() => ({
    lendingRepository: new LendingRepository(),
    itemRepository: new ItemRepository(),
  }), []);

  const lendingService = useMemo(() =>
    new LendingService(repositories.lendingRepository, repositories.itemRepository),
    [repositories]
  );

  const [lendings, setLendings] = useState<(Lending & { itemName?: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  // Lend from here — item picker + form
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [itemPickerSearch, setItemPickerSearch] = useState('');
  const [itemPickerLoading, setItemPickerLoading] = useState(false);
  const [selectedLendItem, setSelectedLendItem] = useState<Item | null>(null);
  const [showLendForm, setShowLendForm] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const [lendNote, setLendNote] = useState('');
  const [lendLoading, setLendLoading] = useState(false);

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
            return { ...lending, itemName: item?.name || 'Unknown Item' };
          } catch {
            return { ...lending, itemName: 'Unknown Item' };
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

  const openItemPicker = async () => {
    setItemPickerLoading(true);
    setItemPickerSearch('');
    setShowItemPicker(true);
    try {
      const items = await repositories.itemRepository.getAll();
      const activeLentIds = new Set(lendings.map((l) => l.item_id));
      setAllItems(items.filter((i) => !activeLentIds.has(i.id)));
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
    setShowLendForm(true);
  };

  const handleLendSubmit = async () => {
    if (!selectedLendItem || !borrowerName.trim()) return;
    setLendLoading(true);
    try {
      await lendingService.createLending({
        item_id: selectedLendItem.id,
        borrower_name: borrowerName.trim(),
        note: lendNote.trim() || undefined,
      });
      setShowLendForm(false);
      setSelectedLendItem(null);
      setBorrowerName('');
      setLendNote('');
      await loadLendings();
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

  const filteredLendings = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return lendings;
    return lendings.filter(
      (l) =>
        (l.itemName ?? '').toLowerCase().includes(q) ||
        l.borrower_name.toLowerCase().includes(q)
    );
  }, [lendings, searchText]);

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderLendingItem = ({ item, index }: { item: Lending & { itemName?: string }, index: number }) => (
    <TouchableOpacity
      style={[
        styles.lendingRow,
        index < lendings.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
      ]}
      onPress={() => router.push(`/lending/${item.id}`)}
      activeOpacity={0.6}
    >
      <View style={[styles.activeDot, { backgroundColor: PRIMARY }]} />
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
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8, paddingBottom: tabBarPadding }]}
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
          <TouchableOpacity
            style={[styles.historyPill, { borderColor, backgroundColor: cardBg }]}
            onPress={() => router.push('/lending/history')}
          >
            <Text style={[styles.historyPillText, { color: PRIMARY }]}>History</Text>
          </TouchableOpacity>
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
              <View style={[styles.card, { backgroundColor: cardBg, borderColor, padding: 0, overflow: 'hidden' }]}>
                <View style={[styles.cardHeaderRow, { borderBottomColor: borderColor }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Active</Text>
                  <View style={[styles.countBadge, { backgroundColor: `${PRIMARY}18` }]}>
                    <Text style={[styles.countBadgeText, { color: PRIMARY }]}>{filteredLendings.length}</Text>
                  </View>
                </View>
                <FlatList
                  data={filteredLendings}
                  renderItem={renderLendingItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                />
              </View>
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
          </View>
        )}
      </ScrollView>
      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: PRIMARY, bottom: insets.bottom + 84 }]}
        onPress={openItemPicker}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Item Picker Modal */}
      <Modal visible={showItemPicker} transparent animationType="slide" onRequestClose={() => setShowItemPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
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
                      <FontAwesomeIcon
                        icon={containerName ? faFolder : faMapPin}
                        size={15}
                        color={PRIMARY}
                      />
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
              onPress={() => setShowItemPicker(false)}
            >
              <Text style={[styles.pickerCancelText, { color: subtleText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Lend Form Modal */}
      <LendingFormModal
        visible={showLendForm}
        item={selectedLendItem}
        borrowerName={borrowerName}
        onBorrowerNameChange={setBorrowerName}
        note={lendNote}
        onNoteChange={setLendNote}
        onSubmit={handleLendSubmit}
        onCancel={() => { setShowLendForm(false); setSelectedLendItem(null); setBorrowerName(''); setLendNote(''); }}
        loading={lendLoading}
      />
    </View>
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: { fontSize: 12, fontWeight: '700' },

  lendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
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

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

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
  pickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '80%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 14 },
  pickerSearchWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 40, gap: 8, marginBottom: 12 },
  pickerSearchInput: { flex: 1, fontSize: 15 },
  pickerList: { marginBottom: 8 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  pickerRowText: { flex: 1 },
  pickerItemName: { fontSize: 15, fontWeight: '500' },
  pickerItemLocation: { fontSize: 12, marginTop: 2 },
  pickerEmpty: { paddingVertical: 32, alignItems: 'center' },
  pickerEmptyText: { fontSize: 15 },
  pickerCancel: { marginTop: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  pickerCancelText: { fontSize: 15, fontWeight: '600' },
});


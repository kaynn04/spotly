/**
 * SpacesPage
 *
 * Main Spaces tab -- minimalist redesign uniform with Outside feature
 */

import React, { useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMagnifyingGlass, faTimes, faChevronRight, faFolder, faFileAlt, faFileArchive } from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useScrollHide } from '@/hooks/use-scroll-hide';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import type { Space } from '@/src/models/Space';
import type { Item } from '@/src/models/Item';
import type { Container } from '@/src/models/Container';
import { SpaceService } from '@/src/services/SpaceService';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { ContainerRepository } from '@/src/repositories/ContainerRepository';
import SpaceFormModal from './components/SpaceFormModal';

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

export default function SpacesPage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const { handleScroll } = useScrollHide();
  const tabBarPadding = useTabBarPadding();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SectionedSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const isSearching = searchText.trim().length > 0;
  const totalSearchResults = useMemo(
    () => searchResults.filter((i) => i.kind !== 'section').length,
    [searchResults]
  );

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  useFocusEffect(
    useCallback(() => {
      loadSpaces();
    }, [])
  );

  const loadSpaces = async () => {
    setLoading(true);
    try {
      const result = await SpaceService.getAllSpaces();
      setSpaces(result);
    } catch (err) {
      console.error('[SpacesPage] Error loading spaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async (text: string) => {
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

  const handleCreateSpace = async (name: string) => {
    await SpaceService.createSpace(name);
    await loadSpaces();
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const renderSpace = ({ item, index }: { item: Space; index: number }) => (
    <TouchableOpacity
      style={[styles.spaceCard, { backgroundColor: cardBg, borderColor }]}
      onPress={() =>
        router.push({ pathname: '/space/[id]' as any, params: { id: item.id } })
      }
      activeOpacity={0.7}
    >
      <View style={[styles.spaceDot, { backgroundColor: PRIMARY }]} />
      <View style={styles.spaceCardContent}>
        <Text style={[styles.spaceName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.spaceDate, { color: subtleText }]}>
          Created {formatDate(item.createdAt)}
        </Text>
      </View>
      <FontAwesomeIcon icon={faChevronRight} size={16} color={subtleText} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      <FlatList
        data={isSearching ? searchResults : spaces}
        keyExtractor={(item) => {
          if (isSearching) {
            const si = item as SectionedSearchItem;
            if (si.kind === 'section') return `section-${si.title}`;
            if (si.kind === 'space') return `space-${si.data.id}`;
            return `result-${si.data.type}-${si.data.id}`;
          }
          return (item as Space).id;
        }}
        renderItem={isSearching ? ({ item }) => {
          const si = item as SectionedSearchItem;
          if (si.kind === 'section') {
            return (
              <Text style={[styles.sectionHeader, { color: PRIMARY }]}>{si.title}</Text>
            );
          }
          if (si.kind === 'space') {
            return renderSpace({ item: si.data, index: 0 });
          }
          const result = si.data;
          const isContainer = result.type === 'container';
          return (
            <TouchableOpacity
              style={[styles.resultCard, { backgroundColor: cardBg, borderColor }]}
              onPress={() => {
                if (isContainer) {
                  router.push({ pathname: '/container/[id]' as any, params: { id: result.id } });
                } else {
                  router.push({ pathname: '/space/[id]' as any, params: { id: result.spaceId } });
                }
              }}
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
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 8, paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
        onScroll={isSearching ? undefined : handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* Page header */}
            <View style={styles.header}>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>Spaces</Text>
                <Text style={[styles.subtitle, { color: subtleText }]}>
                  Organize your belongings
                </Text>
              </View>
              {spaces.length > 0 && !isSearching && (
                <View style={[styles.countBadge, { backgroundColor: `${PRIMARY}18`, borderColor: `${PRIMARY}30` }]}>
                  <Text style={[styles.countBadgeText, { color: PRIMARY }]}>{spaces.length}</Text>
                </View>
              )}
            </View>

            {/* Search bar */}
            <View style={[styles.searchWrapper, { backgroundColor: isDark ? '#1c1c1e' : '#ffffff', borderColor }]}>
              <FontAwesomeIcon icon={faMagnifyingGlass} size={16} color={colors.text} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search items & containers across all spaces..."
                placeholderTextColor={subtleText}
                value={searchText}
                onChangeText={handleSearch}
                returnKeyType="search"
              />
              {isSearching && (
                <TouchableOpacity onPress={() => { setSearchText(''); setSearchResults([]); }} style={styles.clearBtn}>
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
              <Text style={[styles.sectionLabel, { color: subtleText }]}>YOUR SPACES</Text>
            ) : null}
          </>
        }
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
                onPress={() => setFormVisible(true)}
              >
                <Text style={styles.primaryButtonText}>+ Create Space</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* FAB -- only shown when spaces exist */}
      {spaces.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: PRIMARY, bottom: insets.bottom + 84 }]}
          onPress={() => setFormVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <SpaceFormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        onSubmit={handleCreateSpace}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 },
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
});

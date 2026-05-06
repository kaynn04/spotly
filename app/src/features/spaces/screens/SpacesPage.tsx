/**
 * SpacesPage
 *
 * Main Spaces tab -- minimalist redesign uniform with Outside feature
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { Space } from '@/src/models/Space';
import { SpaceService } from '@/src/services/SpaceService';
import SpaceFormModal from './components/SpaceFormModal';

const PRIMARY = '#6b7f99';

export default function SpacesPage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

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
      <Text style={[styles.chevron, { color: subtleText }]}>{'>'}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      <FlatList
        data={spaces}
        keyExtractor={(item) => item.id}
        renderItem={renderSpace}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Spaces</Text>
              <Text style={[styles.subtitle, { color: subtleText }]}>
                Organize your belongings
              </Text>
            </View>
            {spaces.length > 0 && (
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: `${PRIMARY}18`, borderColor: `${PRIMARY}30` },
                ]}
              >
                <Text style={[styles.countBadgeText, { color: PRIMARY }]}>
                  {spaces.length}
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
              <View style={[styles.emptyIconContainer, { backgroundColor: `${PRIMARY}12` }]}>
                <Text style={styles.emptyIcon}>{'🗂\uFE0F'}</Text>
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
          style={[styles.fab, { backgroundColor: PRIMARY, bottom: insets.bottom + 24 }]}
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
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
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

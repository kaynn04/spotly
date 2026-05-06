/**
 * HomePage
 *
 * Main dashboard -- minimalist redesign uniform with all other features.
 *
 * Greeting: Good morning/afternoon/evening + user name (persisted via AsyncStorage)
 * Sections:
 *   - Inventory overview (items, spaces, containers)
 *   - Active lending cards (who has what)
 *   - Outside session progress (if active)
 *   - Recently added items
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { DashboardService } from '@/src/services/DashboardService';
import { UserService } from '@/src/services/UserService';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { SpaceRepository } from '@/src/repositories/SpaceRepository';
import { ContainerRepository } from '@/src/repositories/ContainerRepository';
import { LendingService } from '@/src/features/lending/services/LendingService';
import { LendingRepository } from '@/src/features/lending/repositories/LendingRepository';
import { useOutsideService } from '@/src/features/outside/services/OutsideService';
import { Lending } from '@/src/features/lending/models/Lending';
import NamePromptModal from './components/NamePromptModal';

const PRIMARY = '#6b7f99';
const SUCCESS = '#6b9e7a';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface DashboardData {
  stats: { totalItems: number; totalSpaces: number; totalContainers: number };
  recentItems: { id: string; name: string; spaceName: string; createdAt: string }[];
  activeLendings: Lending[];
  activeSession: { id: string; title: string; itemCount: number; checkedCount: number } | null;
  isEmpty: boolean;
}

DashboardService.initialize(ItemRepository, SpaceRepository, ContainerRepository);

export default function HomePage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const outsideService = useOutsideService();

  const lendingService = React.useMemo(
    () => new LendingService(new LendingRepository(), new ItemRepository()),
    []
  );

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [name, dashboard, activeLendings, session] = await Promise.all([
        UserService.getName(),
        DashboardService.getFullDashboard(),
        lendingService.getActiveLendings().catch(() => []),
        outsideService.getActiveSession().catch(() => null),
      ]);

      if (!name) setShowNamePrompt(true);
      else setUserName(name);

      setData({
        stats: dashboard.stats,
        recentItems: dashboard.recentItems,
        activeLendings,
        activeSession: session
          ? { id: session.id, title: session.title, itemCount: session.itemCount, checkedCount: session.checkedCount }
          : null,
        isEmpty: dashboard.isEmpty,
      });
    } catch (err) {
      console.error('[HomePage] loadAll error:', err);
    } finally {
      setLoading(false);
    }
  };

  const progressPercent =
    data?.activeSession && data.activeSession.itemCount > 0
      ? Math.round((data.activeSession.checkedCount / data.activeSession.itemCount) * 100)
      : 0;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Greeting header ────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greetingText, { color: subtleText }]}>{getGreeting()}</Text>
            <Text style={[styles.nameText, { color: colors.text }]}>
              {userName ?? 'there'} {'\uD83D\uDC4B'}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : (
          <>
            {/* ── Inventory overview ──────────────────────────── */}
            <View style={styles.statsRow}>
              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}
                onPress={() => router.push('/(tabs)/spaces' as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {data?.stats.totalItems ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: subtleText }]}>Items</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}
                onPress={() => router.push('/(tabs)/spaces' as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {data?.stats.totalSpaces ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: subtleText }]}>Spaces</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}
                onPress={() => router.push('/(tabs)/spaces' as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {data?.stats.totalContainers ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: subtleText }]}>Containers</Text>
              </TouchableOpacity>
            </View>

            {/* ── Active outside session ─────────────────────── */}
            {data?.activeSession && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Outside</Text>
                  <TouchableOpacity onPress={() => router.push(`/outside/${data.activeSession!.id}` as any)}>
                    <Text style={[styles.seeAll, { color: PRIMARY }]}>View</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: cardBg, borderColor }]}
                  onPress={() => router.push(`/outside/${data.activeSession!.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sessionRow}>
                    <View style={[styles.activeDot, { backgroundColor: PRIMARY }]} />
                    <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                      {data.activeSession.title}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: `${PRIMARY}18` }]}>
                      <Text style={[styles.statusPillText, { color: PRIMARY }]}>Active</Text>
                    </View>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: isDark ? '#2c2c2e' : '#e8e8ed', marginTop: 12 }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progressPercent}%`,
                          backgroundColor: progressPercent === 100 ? SUCCESS : PRIMARY,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressLabel, { color: subtleText, marginTop: 6 }]}>
                    {data.activeSession.checkedCount}/{data.activeSession.itemCount} items checked
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Active lendings ────────────────────────────── */}
            {(data?.activeLendings?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Lent Out</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/lending' as any)}>
                    <Text style={[styles.seeAll, { color: PRIMARY }]}>See all</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
                  {data!.activeLendings.slice(0, 3).map((lending, index) => (
                    <View
                      key={lending.id}
                      style={[
                        styles.lendingRow,
                        index < Math.min(data!.activeLendings.length, 3) - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: borderColor,
                        },
                      ]}
                    >
                      <View style={[styles.lendingDot, { backgroundColor: PRIMARY }]} />
                      <View style={styles.lendingContent}>
                        <Text style={[styles.lendingBorrower, { color: colors.text }]} numberOfLines={1}>
                          {lending.borrower_name}
                        </Text>
                        <Text style={[styles.lendingMeta, { color: subtleText }]} numberOfLines={1}>
                          since {formatDate(lending.lent_at.toString())}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {data!.activeLendings.length > 3 && (
                    <TouchableOpacity
                      style={styles.viewAllRow}
                      onPress={() => router.push('/(tabs)/lending' as any)}
                    >
                      <Text style={[styles.viewAllText, { color: PRIMARY }]}>
                        +{data!.activeLendings.length - 3} more
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ── Recently added items ───────────────────────── */}
            {(data?.recentItems?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Recently Added</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/spaces' as any)}>
                    <Text style={[styles.seeAll, { color: PRIMARY }]}>Spaces</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
                  {data!.recentItems.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.recentRow,
                        index < data!.recentItems.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: borderColor,
                        },
                      ]}
                    >
                      <View style={styles.recentContent}>
                        <Text style={[styles.recentName, { color: colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.recentMeta, { color: subtleText }]}>
                          {item.spaceName}
                        </Text>
                      </View>
                      <Text style={[styles.recentDate, { color: subtleText }]}>
                        {formatDate(item.createdAt)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Empty state ────────────────────────────────── */}
            {data?.isEmpty && (
              <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
                <Text style={styles.emptyIcon}>{'\uD83D\uDCE6'}</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing here yet</Text>
                <Text style={[styles.emptySubtitle, { color: subtleText }]}>
                  Go to the Spaces tab to create your first space and start organizing.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: PRIMARY }]}
                  onPress={() => router.push('/(tabs)/spaces' as any)}
                >
                  <Text style={styles.emptyBtnText}>Create a Space</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: insets.bottom + 16 }} />
          </>
        )}
      </ScrollView>

      <NamePromptModal
        visible={showNamePrompt}
        onDone={(name) => {
          setUserName(name);
          setShowNamePrompt(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, paddingTop: 4 },
  headerLeft: {},
  greetingText: { fontSize: 15, fontWeight: '500' },
  nameText: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, marginTop: 2 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  // Stats row
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '500', marginTop: 4 },
  // Sections
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  seeAll: { fontSize: 14, fontWeight: '500' },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  // Outside session card
  sessionRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  sessionTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 5, borderRadius: 4, marginHorizontal: 14 },
  progressFill: { height: 5, borderRadius: 4 },
  progressLabel: { fontSize: 12, paddingHorizontal: 14, paddingBottom: 14 },
  // Lending rows
  lendingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, gap: 12 },
  lendingDot: { width: 6, height: 6, borderRadius: 3 },
  lendingContent: { flex: 1 },
  lendingBorrower: { fontSize: 15, fontWeight: '600' },
  lendingMeta: { fontSize: 12, marginTop: 2 },
  viewAllRow: { paddingVertical: 12, paddingHorizontal: 14 },
  viewAllText: { fontSize: 13, fontWeight: '600' },
  // Recent items
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14 },
  recentContent: { flex: 1 },
  recentName: { fontSize: 15, fontWeight: '500' },
  recentMeta: { fontSize: 12, marginTop: 2 },
  recentDate: { fontSize: 12 },
  // Empty state
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: 'center', marginTop: 8 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, alignSelf: 'stretch', alignItems: 'center' },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
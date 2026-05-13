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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { 
  faBox, 
  faSun, 
  faMoon, 
  faChevronRight, 
  faGear,
  faHandshake,
  faSuitcase,
  faShieldAlt,
  faX,
  faPlus,
  faFolder,
} from '@fortawesome/free-solid-svg-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useToggleColorScheme } from '@/src/context/ColorSchemeContext';
import { Colors } from '@/constants/theme';
import { useScrollHide } from '@/hooks/use-scroll-hide';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { DashboardService } from '@/src/services/DashboardService';
import type { DashboardMovedItem } from '@/src/services/DashboardService';
import { UserService } from '@/src/services/UserService';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { LendingService } from '@/src/features/lending/services/LendingService';
import { LendingRepository } from '@/src/features/lending/repositories/LendingRepository';
import { useOutsideService } from '@/src/features/outside/services/OutsideService';
import { Lending } from '@/src/features/lending/models/Lending';
import NamePromptModal from './components/NamePromptModal';
import { WalkthroughService } from '@/src/features/walkthrough/services/WalkthroughService';
import { WALKTHROUGH_STEPS, type SpotlightRect } from '@/src/features/walkthrough/models/WalkthroughStep';
import { useWalkthroughContext } from '@/src/features/walkthrough/context/WalkthroughContext';
import WalkthroughOverlay from '@/src/features/walkthrough/components/WalkthroughOverlay';

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
  recentItems: { id: string; name: string; spaceName: string; containerName: string | null; spaceId: string; containerId: string | null; createdAt: string; photoUri: string | null }[];
  recentlyMoved: DashboardMovedItem[];
  expiringWarranties: { id: string; name: string; spaceName: string; containerName: string | null; spaceId: string; containerId: string | null; warrantyExpiry: string; daysRemaining: number; urgency: 'critical' | 'warning' }[];
  activeLendings: (Lending & { item_name: string })[];
  activeSession: { id: string; title: string; itemCount: number; checkedCount: number } | null;
  isEmpty: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const toggleColorScheme = useToggleColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const outsideService = useOutsideService();
  const { handleScroll } = useScrollHide();
  const tabBarPadding = useTabBarPadding();

  const lendingService = React.useMemo(
    () => new LendingService(new LendingRepository(), new ItemRepository()),
    []
  );

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [dismissedGuidanceCards, setDismissedGuidanceCards] = useState<Set<string>>(new Set());

  const dismissGuidanceCard = useCallback((cardType: string) => {
    setDismissedGuidanceCards((prev) => new Set(prev).add(cardType));
  }, []);

  // Walkthrough
  const { tabBarRef } = useWalkthroughContext();
  const dashboardRef = useRef<View>(null);
  const settingsRef = useRef<View>(null);
  const [walkthroughVisible, setWalkthroughVisible] = useState(false);
  const [walkthroughIndex, setWalkthroughIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('synop:refresh-home', loadAll);
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const check = async () => {
        const done = await WalkthroughService.isDone();
        if (!done && !cancelled) {
          setTimeout(() => {
            if (!cancelled) startWalkthrough();
          }, 600);
        }
      };
      check();
      return () => { cancelled = true; };
    }, [])
  );

  const measureStep = async (index: number): Promise<SpotlightRect | null> => {
    const step = WALKTHROUGH_STEPS[index];
    if (!step) return null;
    try {
      if (step.targetRef === 'dashboard') {
        return await new Promise<SpotlightRect>((resolve, reject) => {
          dashboardRef.current?.measure((_, __, width, height, pageX, pageY) => {
            resolve({ x: pageX, y: pageY, width, height });
          }) ?? reject(new Error('no ref'));
        });
      }
      if (step.targetRef === 'settings') {
        return await new Promise<SpotlightRect>((resolve, reject) => {
          settingsRef.current?.measure((_, __, width, height, pageX, pageY) => {
            resolve({ x: pageX, y: pageY, width, height });
          }) ?? reject(new Error('no ref'));
        });
      }
      if (tabBarRef.current) {
        return await tabBarRef.current.measureTab(step.targetRef);
      }
    } catch {
      // If measurement fails, return null — overlay will use default center
    }
    return null;
  };

  const startWalkthrough = async () => {
    const rect = await measureStep(0);
    setSpotlightRect(rect);
    setWalkthroughIndex(0);
    setWalkthroughVisible(true);
  };

  const handleWalkthroughNext = async () => {
    const nextIndex = walkthroughIndex + 1;
    if (nextIndex >= WALKTHROUGH_STEPS.length) {
      await WalkthroughService.markDone();
      setWalkthroughVisible(false);
      return;
    }
    const rect = await measureStep(nextIndex);
    setSpotlightRect(rect);
    setWalkthroughIndex(nextIndex);
  };

  const handleWalkthroughSkip = async () => {
    await WalkthroughService.markDone();
    setWalkthroughVisible(false);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [name, dashboard, activeLendings, session] = await Promise.all([
        UserService.getName(),
        DashboardService.getFullDashboard(),
        lendingService.getActiveLendingsWithItemNames().catch(() => []),
        outsideService.getActiveSession().catch(() => null),
      ]);

      if (!name) setShowNamePrompt(true);
      else setUserName(name);

      setData({
        stats: dashboard.stats,
        recentItems: dashboard.recentItems,
        recentlyMoved: dashboard.recentlyMoved,
        expiringWarranties: dashboard.expiringWarranties,
        activeLendings,
        activeSession: session
          ? { id: session.id, title: session.title, itemCount: session.itemCount, checkedCount: session.checkedCount }
          : null,
        isEmpty: dashboard.isEmpty,
      });
    } catch {
      // Silently handle load errors; UI will show loading state
    } finally {
      setLoading(false);
    }
  };

  const progressPercent =
    data?.activeSession && data.activeSession.itemCount > 0
      ? Math.round((data.activeSession.checkedCount / data.activeSession.itemCount) * 100)
      : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 8, paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ── Greeting header ────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greetingText, { color: subtleText }]}>{getGreeting()}</Text>
            <View style={styles.greetingRow}>
              <Text style={[styles.nameText, { color: colors.text }]}>
                {userName ?? 'there'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={toggleColorScheme}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.themeToggle, { backgroundColor: isDark ? '#2c2c2e' : '#e8eaed' }]}
            >
              <FontAwesomeIcon
                icon={isDark ? faSun : faMoon}
                size={15}
                color={isDark ? '#fbbf24' : '#6b7f99'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              ref={settingsRef}
              onPress={() => router.push('/settings' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.themeToggle, { backgroundColor: isDark ? '#2c2c2e' : '#e8eaed' }]}
            >
              <FontAwesomeIcon icon={faGear} size={15} color={PRIMARY} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : (
          <>
            {/* ── Inventory overview ──────────────────────────── */}
            <View ref={dashboardRef} style={styles.statsRow}>
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

            {/* ── Quick action bar ──────────────────────────────── */}
            <View style={styles.quickActionGrid}>
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: cardBg, borderColor }]}
                onPress={() => router.push({ pathname: '/(tabs)/spaces' as any, params: { openCreate: '1' } })}
                activeOpacity={0.7}
              >
                <View style={[styles.quickActionIconBox, { backgroundColor: `${PRIMARY}18` }]}>
                  <FontAwesomeIcon icon={faFolder} size={18} color={PRIMARY} />
                </View>
                <Text style={[styles.quickActionLabel, { color: colors.text }]}>Add Space</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: cardBg, borderColor }]}
                onPress={() => router.push('/(tabs)/spaces' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.quickActionIconBox, { backgroundColor: `${PRIMARY}18` }]}>
                  <FontAwesomeIcon icon={faBox} size={18} color={PRIMARY} />
                </View>
                <Text style={[styles.quickActionLabel, { color: colors.text }]}>Add Item</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: cardBg, borderColor }]}
                onPress={() => router.push('/(tabs)/spaces' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.quickActionIconBox, { backgroundColor: `${PRIMARY}18` }]}>
                  <FontAwesomeIcon icon={faBox} size={18} color={PRIMARY} />
                </View>
                <Text style={[styles.quickActionLabel, { color: colors.text }]}>Add Container</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: cardBg, borderColor }]}
                onPress={() => router.push('/(tabs)/lending' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.quickActionIconBox, { backgroundColor: `${PRIMARY}18` }]}>
                  <FontAwesomeIcon icon={faHandshake} size={18} color={PRIMARY} />
                </View>
                <Text style={[styles.quickActionLabel, { color: colors.text }]}>Lend</Text>
              </TouchableOpacity>
            </View>

            {/* ── Lend guidance (if has items but no lendings) ─ */}
            {data && !data.isEmpty && data.stats.totalItems > 0 && (data?.activeLendings?.length ?? 0) === 0 && !dismissedGuidanceCards.has('lend') && (
              <View style={[styles.guidanceCard, { backgroundColor: cardBg, borderColor }]}>
                <TouchableOpacity
                  style={styles.guidanceCardContentWithClose}
                  onPress={() => router.push('/(tabs)/lending' as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.guidanceCardContent}>
                    <View style={[styles.guidanceIconBox, { backgroundColor: `${PRIMARY}18` }]}>
                      <FontAwesomeIcon icon={faHandshake} size={20} color={PRIMARY} />
                    </View>
                    <View style={styles.guidanceTextBlock}>
                      <Text style={[styles.guidanceTitle, { color: colors.text }]}>Lend an item</Text>
                      <Text style={[styles.guidanceSubtitle, { color: subtleText }]}>
                        Share your items with friends and track who has what
                      </Text>
                    </View>
                    <FontAwesomeIcon icon={faChevronRight} size={13} color={subtleText} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.guidanceCloseButton}
                  onPress={() => dismissGuidanceCard('lend')}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <FontAwesomeIcon icon={faX} size={14} color={subtleText} />
                </TouchableOpacity>
              </View>
            )}

            {/* ── Outside guidance (if has items but no session) */}
            {data && !data.isEmpty && data.stats.totalItems > 0 && !data?.activeSession && !dismissedGuidanceCards.has('outside') && (
              <View style={[styles.guidanceCard, { backgroundColor: cardBg, borderColor }]}>
                <TouchableOpacity
                  style={styles.guidanceCardContentWithClose}
                  onPress={() => router.push('/(tabs)/outside' as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.guidanceCardContent}>
                    <View style={[styles.guidanceIconBox, { backgroundColor: `${PRIMARY}18` }]}>
                      <FontAwesomeIcon icon={faSuitcase} size={20} color={PRIMARY} />
                    </View>
                    <View style={styles.guidanceTextBlock}>
                      <Text style={[styles.guidanceTitle, { color: colors.text }]}>Start an outside session</Text>
                      <Text style={[styles.guidanceSubtitle, { color: subtleText }]}>
                        List items you need to bring for your errands and check them off
                      </Text>
                    </View>
                    <FontAwesomeIcon icon={faChevronRight} size={13} color={subtleText} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.guidanceCloseButton}
                  onPress={() => dismissGuidanceCard('outside')}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <FontAwesomeIcon icon={faX} size={14} color={subtleText} />
                </TouchableOpacity>
              </View>
            )}

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

            {/* ── Expiring warranties ────────────────────────── */}
            {(data?.expiringWarranties?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Warranties Expiring Soon</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/spaces' as any)}>
                    <Text style={[styles.seeAll, { color: PRIMARY }]}>See all</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
                  {data!.expiringWarranties.slice(0, 3).map((item, index) => {
                    const route = item.containerId ? `/container/${item.containerId}` : `/space/${item.spaceId}`;
                    const location = item.containerName
                      ? `${item.spaceName} › ${item.containerName}`
                      : item.spaceName;
                    const urgencyColor = item.urgency === 'critical' ? '#d32f2f' : '#f57c00';
                    const isLastItem = index === Math.min(data!.expiringWarranties.length, 3) - 1;
                    
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.warrantyRow,
                          !isLastItem && {
                            borderBottomWidth: 1,
                            borderBottomColor: borderColor,
                          },
                        ]}
                        onPress={() => router.push(route as any)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.warrantyDot, { backgroundColor: urgencyColor }]} />
                        <View style={styles.warrantyContent}>
                          <Text style={[styles.warrantyName, { color: colors.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={[styles.warrantyMeta, { color: subtleText }]} numberOfLines={1}>
                            {location}
                          </Text>
                        </View>
                        <View style={styles.warrantyRight}>
                          <Text style={[styles.warrantyDays, { color: urgencyColor, fontWeight: '600' }]}>
                            {item.daysRemaining === 0 ? 'Today' : item.daysRemaining === 1 ? '1 day' : `${item.daysRemaining}d`}
                          </Text>
                          <FontAwesomeIcon icon={faChevronRight} size={12} color={subtleText} style={{ marginLeft: 6 }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {data!.expiringWarranties.length > 3 && (
                    <TouchableOpacity
                      style={styles.viewAllRow}
                      onPress={() => router.push('/(tabs)/spaces' as any)}
                    >
                      <Text style={[styles.viewAllText, { color: PRIMARY }]}>
                        +{data!.expiringWarranties.length - 3} more
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ── Active lendings ────────────────────────────── */}
            {(data?.activeLendings?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Lending</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/lending' as any)}>
                    <Text style={[styles.seeAll, { color: PRIMARY }]}>See all</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
                  {data!.activeLendings.slice(0, 3).map((lending, index) => (
                    <TouchableOpacity
                      key={lending.id}
                      style={[
                        styles.lendingRow,
                        index < Math.min(data!.activeLendings.length, 3) - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: borderColor,
                        },
                      ]}
                      onPress={() => router.push(`/lending/${lending.id}` as any)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.lendingDot, { backgroundColor: PRIMARY }]} />
                      <View style={styles.lendingContent}>
                        <Text style={[styles.lendingBorrower, { color: colors.text }]} numberOfLines={1}>
                          {lending.item_name}
                        </Text>
                        <Text style={[styles.lendingMeta, { color: subtleText }]} numberOfLines={1}>
                          Lent to {lending.borrower_name} · {formatDate(lending.lent_at.toString())}
                        </Text>
                      </View>
                      <FontAwesomeIcon icon={faChevronRight} size={12} color={subtleText} />
                    </TouchableOpacity>
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
                  {data!.recentItems.map((item, index) => {
                    const route = item.containerId ? `/container/${item.containerId}` : `/space/${item.spaceId}`;
                    const location = item.containerName
                      ? `${item.spaceName} › ${item.containerName}`
                      : item.spaceName;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.recentRow,
                          index < data!.recentItems.length - 1 && {
                            borderBottomWidth: 1,
                            borderBottomColor: borderColor,
                          },
                        ]}
                        onPress={() => router.push(route as any)}
                        activeOpacity={0.7}
                      >
                        {item.photoUri && (
                          <Image
                            source={{ uri: item.photoUri }}
                            style={styles.recentThumbnail}
                          />
                        )}
                        {!item.photoUri && (
                          <View style={[styles.recentThumbnailPlaceholder, { backgroundColor: isDark ? '#2c2c2e' : '#e8eaed' }]}>
                            <FontAwesomeIcon icon={faBox} size={16} color={subtleText} />
                          </View>
                        )}
                        <View style={styles.recentContent}>
                          <Text style={[styles.recentName, { color: colors.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={[styles.recentMeta, { color: subtleText }]} numberOfLines={1}>
                            {location}
                          </Text>
                        </View>
                        <View style={styles.recentRight}>
                          <Text style={[styles.recentDate, { color: subtleText }]}>
                            {formatDate(item.createdAt)}
                          </Text>
                          <FontAwesomeIcon icon={faChevronRight} size={12} color={subtleText} style={{ marginLeft: 6 }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Recently moved items ───────────────────────── */}
            {(data?.recentlyMoved?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Recently Moved</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/spaces' as any)}>
                    <Text style={[styles.seeAll, { color: PRIMARY }]}>Spaces</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
                  {data!.recentlyMoved.map((item, index) => {
                    const location = item.containerName
                      ? `${item.spaceName} › ${item.containerName}`
                      : item.spaceName;
                    const route = item.kind === 'container'
                      ? `/container/${item.id}`
                      : `/item/${item.id}`;
                    return (
                      <TouchableOpacity
                        key={`${item.kind}-${item.id}`}
                        style={[
                          styles.recentRow,
                          index < data!.recentlyMoved.length - 1 && {
                            borderBottomWidth: 1,
                            borderBottomColor: borderColor,
                          },
                        ]}
                        onPress={() => router.push(route as any)}
                        activeOpacity={0.7}
                      >
                        {item.photoUri && (
                          <Image
                            source={{ uri: item.photoUri }}
                            style={styles.recentThumbnail}
                          />
                        )}
                        {!item.photoUri && (
                          <View style={[styles.recentThumbnailPlaceholder, { backgroundColor: isDark ? '#2c2c2e' : '#e8eaed' }]}>
                            <FontAwesomeIcon icon={faBox} size={16} color={subtleText} />
                          </View>
                        )}
                        <View style={styles.recentContent}>
                          <View style={styles.recentNameRow}>
                            <Text style={[styles.recentName, { color: colors.text }]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            {item.kind === 'container' && (
                              <View style={[styles.kindPill, { backgroundColor: isDark ? '#2c2c2e' : '#e8eaed' }]}>
                                <Text style={[styles.kindPillText, { color: subtleText }]}>Container</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.recentMeta, { color: subtleText }]} numberOfLines={1}>
                            {location}
                          </Text>
                        </View>
                        <View style={styles.recentRight}>
                          <Text style={[styles.recentDate, { color: subtleText }]}>
                            {formatDate(item.updatedAt)}
                          </Text>
                          <FontAwesomeIcon icon={faChevronRight} size={12} color={subtleText} style={{ marginLeft: 6 }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── No items guidance state ─────────────────────── */}
            {data && !data.isEmpty && data.stats.totalItems === 0 && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={[styles.guidanceCard, { backgroundColor: cardBg, borderColor }]}
                  onPress={() => router.push('/(tabs)/spaces' as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.guidanceCardContent}>
                    <View style={[styles.guidanceIconBox, { backgroundColor: `${PRIMARY}18` }]}>
                      <FontAwesomeIcon icon={faBox} size={20} color={PRIMARY} />
                    </View>
                    <View style={styles.guidanceTextBlock}>
                      <Text style={[styles.guidanceTitle, { color: colors.text }]}>Add your first item</Text>
                      <Text style={[styles.guidanceSubtitle, { color: subtleText }]}>
                        Add items to your spaces to unlock lending, outside sessions, and more
                      </Text>
                    </View>
                    <FontAwesomeIcon icon={faChevronRight} size={13} color={subtleText} />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Empty state (no spaces) ────────────────────── */}
            {data?.isEmpty && !data?.activeSession && !(data?.activeLendings?.length > 0) && (
              <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
                <FontAwesomeIcon icon={faBox} size={40} color={PRIMARY} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing here yet</Text>
                <Text style={[styles.emptySubtitle, { color: subtleText }]}>
                  Go to the Spaces tab to create your first space and start organizing.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: PRIMARY }]}
                  onPress={() => router.push({ pathname: '/(tabs)/spaces' as any, params: { openCreate: '1' } })}
                >
                  <Text style={styles.emptyBtnText}>+ Create a Space</Text>
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

      <WalkthroughOverlay
        visible={walkthroughVisible}
        step={WALKTHROUGH_STEPS[walkthroughIndex] ?? null}
        spotlightRect={spotlightRect}
        currentIndex={walkthroughIndex}
        onNext={handleWalkthroughNext}
        onSkip={handleWalkthroughSkip}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, paddingTop: 4 },
  headerLeft: {},
  headerRight: { flexDirection: 'row', gap: 8 },
  themeToggle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingText: { fontSize: 15, fontWeight: '500' },
  greetingRow: {},
  nameText: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, marginTop: 2 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  // Stats row
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '500', marginTop: 4 },
  // Quick action bar
  quickActionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  quickActionButton: { flex: 1, minWidth: '48%', borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
  quickActionIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickActionLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
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
  // Warranty rows
  warrantyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, gap: 12 },
  warrantyDot: { width: 6, height: 6, borderRadius: 3 },
  warrantyContent: { flex: 1 },
  warrantyName: { fontSize: 15, fontWeight: '600' },
  warrantyMeta: { fontSize: 12, marginTop: 2 },
  warrantyRight: { flexDirection: 'row', alignItems: 'center' },
  warrantyDays: { fontSize: 13, marginRight: 6 },
  viewAllRow: { paddingVertical: 12, paddingHorizontal: 14 },
  viewAllText: { fontSize: 13, fontWeight: '600' },
  // Recent items
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, gap: 10 },
  recentThumbnail: { width: 44, height: 44, borderRadius: 8 },
  recentThumbnailPlaceholder: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  recentContent: { flex: 1 },
  recentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recentName: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  kindPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  kindPillText: { fontSize: 11, fontWeight: '500' },
  recentMeta: { fontSize: 12, marginTop: 2 },
  recentRight: { flexDirection: 'row', alignItems: 'center' },
  recentDate: { fontSize: 12 },
  // Guidance card (feature onboarding)
  guidanceCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16, position: 'relative' },
  guidanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  guidanceCardContentWithClose: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 32 },
  guidanceCardContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  guidanceIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  guidanceTextBlock: { flex: 1 },
  guidanceTitle: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  guidanceSubtitle: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  guidanceCloseButton: { position: 'absolute', top: 12, right: 12, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  // Empty state
  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: 'center', marginTop: 8 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, alignSelf: 'stretch', alignItems: 'center' },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
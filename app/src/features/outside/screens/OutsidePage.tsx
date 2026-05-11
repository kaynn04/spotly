/**
 * OutsidePage
 *
 * Main Outside tab — modern minimalist redesign
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faSuitcase, faChevronRight, faCheckCircle, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { OutsideSession } from '../models/OutsideSession';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useScrollHide } from '@/hooks/use-scroll-hide';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { useOutsideService } from '../services/OutsideService';
import { OutsideSessionItemWithContext } from '../models/OutsideSessionItem';
import SessionFormModal from './components/SessionFormModal';
import { ItemRepository } from '@/src/repositories/ItemRepository';

interface SessionCardState {
  loading: boolean;
  error: string | null;
  itemCount: number;
  checkedCount: number;
}

const PRIMARY = '#6b7f99';

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function OutsidePage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const outsideService = useOutsideService();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const { handleScroll } = useScrollHide();
  const tabBarPadding = useTabBarPadding();

  const [sessionCard, setSessionCard] = useState<SessionCardState>({
    loading: false,
    error: null,
    itemCount: 0,
    checkedCount: 0,
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState<string>('');
  const [sessionItems, setSessionItems] = useState<OutsideSessionItemWithContext[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [recentSessions, setRecentSessions] = useState<OutsideSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadActiveSession();
      loadRecentSessions();
    }, [])
  );

  // Listen for refresh events from voice feature or other sources
  useEffect(() => {
    const handleRefresh = async () => {
      await Promise.all([loadActiveSession(), loadRecentSessions()]);
    };
    const subscription = DeviceEventEmitter.addListener('spotly:refresh-home', handleRefresh);
    return () => subscription.remove();
  }, []);

  const loadActiveSession = async () => {
    setSessionCard({ loading: true, error: null, itemCount: 0, checkedCount: 0 });
    try {
      const session = await outsideService.getActiveSession();
      if (session) {
        setActiveSessionId(session.id);
        setActiveSessionTitle(session.title);
        const items = await outsideService.getSessionItems(session.id);
        setSessionItems(items);
        setSessionCard({
          loading: false,
          error: null,
          itemCount: session.itemCount,
          checkedCount: session.checkedCount,
        });
      } else {
        setActiveSessionId(null);
        setActiveSessionTitle('');
        setSessionItems([]);
        setSessionCard({ loading: false, error: null, itemCount: 0, checkedCount: 0 });
      }
    } catch (err) {
      console.error('Error loading active session:', err);
      setSessionCard({ loading: false, error: 'Failed to load session', itemCount: 0, checkedCount: 0 });
    }
  };

  const loadRecentSessions = async () => {
    try {
      const completed = await outsideService.getCompletedSessions();
      setRecentSessions(completed.slice(0, 5));
    } catch {
      // Non-critical, silently skip
    }
  };

  const handleViewHistory = () => router.push('/outside/history');
  const handleOpenSession = () => activeSessionId && router.push(`/outside/${activeSessionId}`);
  const handleCompleteSession = () => activeSessionId && router.push(`/outside/${activeSessionId}`);
  const handleCreateSession = async () => {
    try {
      const items = await new ItemRepository().getAll();
      if (items.length === 0) {
        Alert.alert(
          'No Items Yet',
          'Add items to your spaces first before starting an outside session.',
          [{ text: 'OK' }]
        );
        return;
      }
    } catch {
      // If check fails, allow through
    }
    setFormVisible(true);
  };

  const previewItems = sessionItems.slice(0, 5);
  const progressPercent =
    sessionCard.itemCount > 0
      ? Math.round((sessionCard.checkedCount / sessionCard.itemCount) * 100)
      : 0;

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Outside</Text>
            <Text style={[styles.subtitle, { color: subtleText }]}>Track items you've taken out</Text>
          </View>
          <TouchableOpacity style={[styles.historyPill, { borderColor: borderColor, backgroundColor: cardBg }]} onPress={handleViewHistory}>
            <Text style={[styles.historyPillText, { color: PRIMARY }]}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {sessionCard.loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : sessionCard.error ? (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.errorText, { color: '#d32f2f' }]}>{sessionCard.error}</Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: PRIMARY }]} onPress={loadActiveSession}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : activeSessionId ? (
          <View style={styles.activeSection}>

            {/* Main Session Card — tappable, opens detail */}
            <TouchableOpacity
              style={[styles.card, { backgroundColor: cardBg, borderColor }]}
              onPress={handleOpenSession}
              activeOpacity={0.7}
            >
              {/* Session name row */}
              <View style={styles.sessionHeaderRow}>
                <View style={[styles.sessionDot, { backgroundColor: progressPercent === 100 ? '#6b9e7a' : PRIMARY }]} />
                <Text style={[styles.sessionCardTitle, { color: colors.text }]} numberOfLines={1}>
                  {activeSessionTitle}
                </Text>
                <View style={[styles.activeBadge, { backgroundColor: progressPercent === 100 ? '#6b9e7a18' : `${PRIMARY}18` }]}>
                  <Text style={[styles.activeBadgeText, { color: progressPercent === 100 ? '#6b9e7a' : PRIMARY }]}>
                    {progressPercent === 100 ? 'Ready' : 'Active'}
                  </Text>
                </View>
                <FontAwesomeIcon icon={faChevronRight} size={14} color={subtleText} />
              </View>

              {/* Progress row */}
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={[styles.progressLabel, { color: subtleText }]}>
                    {sessionCard.checkedCount}/{sessionCard.itemCount} checked
                  </Text>
                  <Text style={[styles.progressPercent, { color: progressPercent === 100 ? '#6b9e7a' : PRIMARY }]}>
                    {progressPercent}%
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: isDark ? '#2c2c2e' : '#e8e8ed' }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: progressPercent === 100 ? '#6b9e7a' : PRIMARY,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Items quick preview — just names, no interactions */}
              {previewItems.length > 0 && (
                <View style={styles.previewList}>
                  {previewItems.slice(0, 3).map((item) => {
                    const checked = Boolean(item.is_checked);
                    return (
                      <View key={item.id} style={styles.previewItem}>
                        <View style={[styles.previewDot, { backgroundColor: checked ? '#6b9e7a' : isDark ? '#48484a' : '#c7c7cc' }]} />
                        <Text
                          style={[styles.previewItemText, { color: checked ? subtleText : colors.text }]}
                          numberOfLines={1}
                        >
                          {item.item_name}
                        </Text>
                      </View>
                    );
                  })}
                  {sessionCard.itemCount > 3 && (
                    <Text style={[styles.previewMore, { color: subtleText }]}>
                      +{sessionCard.itemCount - 3} more
                    </Text>
                  )}
                </View>
              )}

              {/* Tap hint */}
              <View style={styles.tapHintRow}>
                <Text style={[styles.tapHintText, { color: PRIMARY }]}>
                  Tap to manage session
                </Text>
              </View>
            </TouchableOpacity>

            {/* Quick Action: Complete (only shown when 100%) */}
            {progressPercent === 100 && (
              <TouchableOpacity
                style={[styles.completeButton, { backgroundColor: '#6b9e7a' }]}
                onPress={handleCompleteSession}
              >
                <FontAwesomeIcon icon={faCheckCircle} size={18} color="#fff" />
                <Text style={styles.completeButtonText}>Complete Session</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Empty State */
          <View style={[styles.card, styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={[styles.emptyIconContainer, { backgroundColor: `${PRIMARY}12` }]}>
              <FontAwesomeIcon icon={faSuitcase} size={32} color={PRIMARY} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Session</Text>
            <Text style={[styles.emptySubtitle, { color: subtleText }]}>
              Start a checklist to track items you take outside
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: PRIMARY, alignSelf: 'stretch' }]}
              onPress={handleCreateSession}
            >
              <Text style={styles.primaryButtonText}>+ Start New Session</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Sessions — shown regardless of active session state */}
        {recentSessions.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <FontAwesomeIcon icon={faClockRotateLeft} size={13} color={subtleText} />
              <Text style={[styles.recentTitle, { color: subtleText }]}>Recent Sessions</Text>
              <TouchableOpacity onPress={handleViewHistory}>
                <Text style={[styles.recentSeeAll, { color: PRIMARY }]}>See all</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor, padding: 0, overflow: 'hidden' }]}>
              {recentSessions.map((session, index) => {
                const date = new Date(session.completed_at ?? session.created_at);
                const label = formatRelativeDate(date);
                return (
                  <TouchableOpacity
                    key={session.id}
                    style={[
                      styles.recentRow,
                      index < recentSessions.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
                    ]}
                    onPress={() => router.push(`/outside/${session.id}`)}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.recentDot, { backgroundColor: '#6b9e7a' }]} />
                    <Text style={[styles.recentSessionName, { color: colors.text }]} numberOfLines={1}>
                      {session.title}
                    </Text>
                    <Text style={[styles.recentDate, { color: subtleText }]}>{label}</Text>
                    <FontAwesomeIcon icon={faChevronRight} size={11} color={subtleText} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <SessionFormModal
        visible={formVisible}
        onClose={() => {
          setFormVisible(false);
          loadActiveSession();
          loadRecentSessions();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16 },

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
  errorText: { fontSize: 15, marginBottom: 16, textAlign: 'center' },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  activeSection: { gap: 0 },

  /* Session header */
  sessionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  sessionDot: { width: 8, height: 8, borderRadius: 4 },
  sessionCardTitle: { fontSize: 17, fontWeight: '600', flex: 1 },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  activeBadgeText: { fontSize: 11, fontWeight: '600' },

  /* Progress */
  progressSection: { gap: 6, marginBottom: 14 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 13 },
  progressPercent: { fontSize: 13, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  /* Preview list */
  previewList: { gap: 6, marginBottom: 12 },
  previewItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewDot: { width: 6, height: 6, borderRadius: 3 },
  previewItemText: { fontSize: 14, fontWeight: '400' },
  previewMore: { fontSize: 13, marginLeft: 14, fontStyle: 'italic' },

  /* Tap hint */
  tapHintRow: { alignItems: 'center', paddingTop: 6, borderTopWidth: 1, borderTopColor: 'transparent' },
  tapHintText: { fontSize: 13, fontWeight: '600' },

  /* Complete button */
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  completeButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  /* Card header */
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardHeaderTitle: { fontSize: 16, fontWeight: '600' },
  cardHeaderCount: { fontSize: 13 },

  /* Empty state */
  emptyCard: { alignItems: 'center', paddingVertical: 36, gap: 12, marginTop: 24 },
  emptyIconContainer: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyIconText: { fontSize: 36 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16, marginBottom: 8 },

  /* Shared button */
  primaryButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  /* Recent sessions */
  recentSection: { marginTop: 24 },
  recentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  recentTitle: { fontSize: 13, fontWeight: '600', flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  recentSeeAll: { fontSize: 13, fontWeight: '600' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  recentDot: { width: 7, height: 7, borderRadius: 4 },
  recentSessionName: { fontSize: 15, fontWeight: '500', flex: 1 },
  recentDate: { fontSize: 13 },
});

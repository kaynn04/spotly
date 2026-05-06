/**
 * OutsidePage
 *
 * Main Outside tab — modern minimalist redesign
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useOutsideService } from '../services/OutsideService';
import { OutsideSessionItemWithContext } from '../models/OutsideSessionItem';
import SessionFormModal from './components/SessionFormModal';

interface SessionCardState {
  loading: boolean;
  error: string | null;
  itemCount: number;
  checkedCount: number;
}

const PRIMARY = '#0a84ff';

export default function OutsidePage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const outsideService = useOutsideService();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

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

  useFocusEffect(
    useCallback(() => {
      loadActiveSession();
    }, [])
  );

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

  const handleToggleItem = async (itemId: string) => {
    if (!activeSessionId) return;
    try {
      await outsideService.checkItem(activeSessionId, itemId);
      await loadActiveSession();
    } catch (err) {
      console.error('Error toggling item:', err);
    }
  };

  const handleViewHistory = () => router.push('/outside/history');
  const handleOpenSession = () => activeSessionId && router.push(`/outside/${activeSessionId}`);
  const handleAddItems = () => activeSessionId && router.push(`/outside/${activeSessionId}`);
  const handleCompleteSession = () => activeSessionId && router.push(`/outside/${activeSessionId}`);
  const handleCreateSession = () => setFormVisible(true);

  const previewItems = sessionItems.slice(0, 5);
  const progressPercent =
    sessionCard.itemCount > 0
      ? Math.round((sessionCard.checkedCount / sessionCard.itemCount) * 100)
      : 0;

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const sectionBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e8e8ed';
  const subtleText = isDark ? '#8e8e93' : '#6b7280';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f2f2f7' }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
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
            <Text style={[styles.errorText, { color: '#ef4444' }]}>{sessionCard.error}</Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: PRIMARY }]} onPress={loadActiveSession}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : activeSessionId ? (
          <View style={styles.activeSection}>

            {/* Session Status Card */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
              {/* Session name row */}
              <View style={styles.sessionHeaderRow}>
                <View style={[styles.sessionDot, { backgroundColor: PRIMARY }]} />
                <Text style={[styles.sessionCardTitle, { color: colors.text }]} numberOfLines={1}>
                  {activeSessionTitle}
                </Text>
                <View style={[styles.activeBadge, { backgroundColor: `${PRIMARY}18` }]}>
                  <Text style={[styles.activeBadgeText, { color: PRIMARY }]}>Active</Text>
                </View>
              </View>

              {/* Progress row */}
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={[styles.progressLabel, { color: subtleText }]}>Progress</Text>
                  <Text style={[styles.progressValue, { color: colors.text }]}>
                    {sessionCard.checkedCount}/{sessionCard.itemCount} items
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: isDark ? '#2c2c2e' : '#e8e8ed' }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: progressPercent === 100 ? '#34c759' : PRIMARY,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressPercent, { color: progressPercent === 100 ? '#34c759' : PRIMARY }]}>
                  {progressPercent}% complete
                </Text>
              </View>
            </View>

            {/* Items Preview Card */}
            {previewItems.length > 0 && (
              <View style={[styles.card, { backgroundColor: sectionBg, borderColor }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardHeaderTitle, { color: colors.text }]}>Items</Text>
                  <Text style={[styles.cardHeaderCount, { color: subtleText }]}>{sessionCard.itemCount} total</Text>
                </View>

                {previewItems.map((item, index) => {
                  const checked = Boolean(item.is_checked);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.itemRow,
                        index < previewItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
                      ]}
                      onPress={() => handleToggleItem(item.item_id)}
                      activeOpacity={0.6}
                    >
                      {/* Custom checkbox */}
                      <View style={[styles.checkCircle, checked ? { backgroundColor: PRIMARY, borderColor: PRIMARY } : { borderColor: isDark ? '#48484a' : '#c7c7cc' }]}>
                        {checked && <Text style={styles.checkMark}>✓</Text>}
                      </View>

                      <View style={styles.itemTextGroup}>
                        <Text
                          style={[
                            styles.itemNameText,
                            {
                              color: checked ? subtleText : colors.text,
                              textDecorationLine: checked ? 'line-through' : 'none',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {item.item_name}
                        </Text>
                        {item.space_name && item.space_name !== 'Unknown Space' && (
                          <Text style={[styles.itemLocationText, { color: subtleText }]}>
                            {item.space_name}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {sessionCard.itemCount > 5 && (
                  <TouchableOpacity style={styles.viewAllRow} onPress={handleOpenSession}>
                    <Text style={[styles.viewAllText, { color: PRIMARY }]}>
                      See all {sessionCard.itemCount} items
                    </Text>
                    <Text style={{ color: PRIMARY, fontSize: 14 }}>›</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.outlineButton, { borderColor: PRIMARY, backgroundColor: cardBg }]}
                onPress={handleAddItems}
              >
                <Text style={[styles.outlineButtonText, { color: PRIMARY }]}>+ Add Items</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: PRIMARY, flex: 1 }]}
                onPress={handleCompleteSession}
              >
                <Text style={styles.primaryButtonText}>Complete</Text>
              </TouchableOpacity>
            </View>

          </View>
        ) : (
          /* Empty State */
          <View style={[styles.card, styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={[styles.emptyIconContainer, { backgroundColor: `${PRIMARY}12` }]}>
              <Text style={styles.emptyIconText}>📦</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Session</Text>
            <Text style={[styles.emptySubtitle, { color: subtleText }]}>
              Start a checklist to track items you take outside
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: PRIMARY, alignSelf: 'stretch' }]}
              onPress={handleCreateSession}
            >
              <Text style={styles.primaryButtonText}>Start New Session</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <SessionFormModal
        visible={formVisible}
        onClose={() => {
          setFormVisible(false);
          loadActiveSession();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

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
  progressSection: { gap: 6 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 13 },
  progressValue: { fontSize: 13, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressPercent: { fontSize: 12, fontWeight: '600', textAlign: 'right' },

  /* Card header */
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardHeaderTitle: { fontSize: 16, fontWeight: '600' },
  cardHeaderCount: { fontSize: 13 },

  /* Item row */
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  itemTextGroup: { flex: 1 },
  itemNameText: { fontSize: 15, fontWeight: '500' },
  itemLocationText: { fontSize: 12, marginTop: 1 },

  viewAllRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: 'transparent' },
  viewAllText: { fontSize: 14, fontWeight: '600' },

  /* Action buttons */
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  outlineButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: { fontSize: 15, fontWeight: '600' },

  /* Empty state */
  emptyCard: { alignItems: 'center', paddingVertical: 36, gap: 12, marginTop: 24 },
  emptyIconContainer: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyIconText: { fontSize: 36 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16, marginBottom: 8 },
});

/**
 * SessionHistoryScreen
 *
 * View completed outside sessions — modern minimalist redesign
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useOutsideService } from '../services/OutsideService';
import { OutsideSession } from '../models/OutsideSession';
import { OutsideSessionItemWithContext } from '../models/OutsideSessionItem';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';

const PRIMARY = '#4f8f7b';

export default function SessionHistoryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const outsideService = useOutsideService();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const [sessions, setSessions] = useState<OutsideSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<OutsideSessionItemWithContext[]>([]);
  const [expandLoading, setExpandLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await outsideService.getCompletedSessions();
      setSessions(data);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = (sessionId: string, sessionTitle: string) => {
    Alert.alert('Delete Session', `Delete "${sessionTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await outsideService.deleteSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (expandedId === sessionId) { setExpandedId(null); setExpandedItems([]); }
          } catch (err) {
            console.error('Error deleting session:', err);
            Alert.alert('Error', 'Failed to delete session');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleToggleExpand = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      setExpandedItems([]);
      return;
    }
    setExpandedId(sessionId);
    setExpandLoading(true);
    try {
      const items = await outsideService.getSessionItems(sessionId);
      setExpandedItems(items);
    } catch {
      setExpandedItems([]);
    } finally {
      setExpandLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const cardBg = isDark ? '#1c1c1e' : '#ffffff';

  const headerBar = (
    <View style={[styles.headerBar, { borderBottomColor: borderColor, backgroundColor: isDark ? '#1c1c1e' : '#ffffff' }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <FontAwesomeIcon icon={faChevronLeft} size={18} color={PRIMARY} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>History</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]} edges={['top', 'bottom']}>
        {headerBar}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]} edges={['top', 'bottom']}>
      {headerBar}

      {/* Error state */}
      {error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: '#d32f2f' }]}>{error}</Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: PRIMARY }]} onPress={loadSessions}>
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sessions.length === 0 ? (
        /* Empty state */
        <View style={styles.center}>
          <View style={[styles.emptyIconWrap, { backgroundColor: `${PRIMARY}12` }]}>
            <Text style={styles.emptyIconText}>🕓</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No History Yet</Text>
          <Text style={[styles.emptySubtitle, { color: subtleText }]}>
            Completed sessions will appear here
          </Text>
        </View>
      ) : (
        /* Session list */
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { backgroundColor: cardBg }]}
          renderItem={({ item, index }) => {
            const isExpanded = expandedId === item.id;
            return (
              <View>
                <TouchableOpacity
                  style={[
                    styles.sessionRow,
                    !isExpanded && index < sessions.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
                  ]}
                  onPress={() => handleToggleExpand(item.id)}
                  activeOpacity={0.7}
                >
                  {/* Completion dot */}
                  <View style={[styles.completedDot, { backgroundColor: isDark ? '#4ade80' : '#6b9e7a' }]} />

                  {/* Info */}
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.sessionDate, { color: subtleText }]}>
                      {item.completed_at ? formatDate(item.completed_at) : 'Unknown date'}
                    </Text>
                  </View>

                  {/* Expand / Delete */}
                  <Text style={[styles.expandIcon, { color: subtleText }]}>{isExpanded ? '▾' : '›'}</Text>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteSession(item.id, item.title)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.deleteIcon, { color: isDark ? '#48484a' : '#c7c7cc' }]}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>

                {/* Expanded items */}
                {isExpanded && (
                  <View style={[styles.expandedSection, { borderBottomWidth: index < sessions.length - 1 ? 1 : 0, borderBottomColor: borderColor }]}>
                    {expandLoading ? (
                      <ActivityIndicator size="small" color={PRIMARY} style={{ paddingVertical: 12 }} />
                    ) : expandedItems.length === 0 ? (
                      <Text style={[styles.expandedEmpty, { color: subtleText }]}>No items recorded</Text>
                    ) : (
                      expandedItems.map((si) => {
                        const checked = Boolean(si.is_checked);
                        const location = si.container_name
                          ? `${si.space_name ?? ''} › ${si.container_name}`
                          : si.space_name;
                        const movedTo = si.moved_to_container_name
                          ? `${si.moved_to_space_name} › ${si.moved_to_container_name}`
                          : si.moved_to_space_name;
                        const issueLabel = si.issue_status === 'LOST'
                          ? 'Reported lost'
                          : si.issue_status === 'NOT_BROUGHT'
                          ? 'Forgot to bring'
                          : null;
                        return (
                          <View key={si.id} style={styles.expandedItem}>
                            <View style={[styles.expandedCheck, { backgroundColor: checked ? (isDark ? '#4ade80' : '#6b9e7a') : isDark ? '#48484a' : '#d1d5db' }]}>
                              {checked && <Text style={styles.expandedCheckMark}>✓</Text>}
                            </View>
                            <View style={styles.expandedItemText}>
                              <Text style={[styles.expandedItemName, { color: colors.text, textDecorationLine: checked ? 'line-through' : 'none' }]} numberOfLines={1}>
                                {si.item_name}
                              </Text>
                              {movedTo ? (
                                <Text style={[styles.expandedItemLocation, { color: isDark ? '#fbbf24' : '#e8a838' }]} numberOfLines={1}>
                                  Moved → {movedTo}
                                </Text>
                              ) : location ? (
                                <Text style={[styles.expandedItemLocation, { color: subtleText }]} numberOfLines={1}>
                                  {location}
                                </Text>
                              ) : null}
                              {issueLabel && (
                                <Text style={[styles.expandedItemIssue, { color: si.issue_status === 'LOST' ? '#d32f2f' : '#f57c00' }]}>
                                  {issueLabel}
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { paddingVertical: 8, paddingRight: 8, width: 60 },
  backBtnText: { fontSize: 17, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerSpacer: { width: 60 },

  listContent: { marginTop: 16, marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  completedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6b9e7a' },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontSize: 16, fontWeight: '600' },
  sessionDate: { fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 4 },
  deleteIcon: { fontSize: 14 },
  expandIcon: { fontSize: 14, marginRight: 4 },

  /* Expanded items */
  expandedSection: { paddingHorizontal: 16, paddingBottom: 12 },
  expandedEmpty: { fontSize: 13, paddingVertical: 8, paddingLeft: 20 },
  expandedItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingLeft: 20, gap: 10 },
  expandedCheck: { width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  expandedCheckMark: { color: '#fff', fontSize: 9, fontWeight: '800' },
  expandedItemText: { flex: 1 },
  expandedItemName: { fontSize: 14, fontWeight: '500' },
  expandedItemLocation: { fontSize: 11, marginTop: 1 },
  expandedItemIssue: { fontSize: 11, marginTop: 1, fontWeight: '700' },

  /* Empty state */
  emptyIconWrap: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyIconText: { fontSize: 36 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },

  errorText: { fontSize: 15, marginBottom: 16, textAlign: 'center' },
  primaryButton: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

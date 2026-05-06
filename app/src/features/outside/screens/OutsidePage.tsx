/**
 * OutsidePage
 * 
 * Main Outside tab view
 * Shows active session or empty state
 * 
 * Implementation: T007
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useOutsideService } from '../services/OutsideService';
import SessionFormModal from './components/SessionFormModal';

interface SessionCardState {
  loading: boolean;
  error: string | null;
  itemCount: number;
  checkedCount: number;
}

export default function OutsidePage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const outsideService = useOutsideService();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [sessionCard, setSessionCard] = useState<SessionCardState>({
    loading: false,
    error: null,
    itemCount: 0,
    checkedCount: 0,
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState<string>('');
  const [formVisible, setFormVisible] = useState(false);

  // Load active session when tab is focused
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
        setSessionCard({
          loading: false,
          error: null,
          itemCount: session.itemCount,
          checkedCount: session.checkedCount,
        });
      } else {
        setActiveSessionId(null);
        setActiveSessionTitle('');
        setSessionCard({
          loading: false,
          error: null,
          itemCount: 0,
          checkedCount: 0,
        });
      }
    } catch (err) {
      console.error('Error loading active session:', err);
      setSessionCard({
        loading: false,
        error: 'Failed to load session',
        itemCount: 0,
        checkedCount: 0,
      });
    }
  };

  const handleCreateSession = () => {
    setFormVisible(true);
  };

  const handleOpenSession = () => {
    if (activeSessionId) {
      router.push(`/outside/${activeSessionId}`);
    }
  };

  const handleViewHistory = () => {
    router.push('/outside/history');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Outside</Text>
          <TouchableOpacity
            style={[styles.historyButton, { backgroundColor: colors.tint }]}
            onPress={handleViewHistory}
          >
            <Text style={[styles.historyButtonText, { color: '#fff' }]}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {sessionCard.loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : sessionCard.error ? (
          <View style={styles.centerContainer}>
            <Text style={[styles.errorText, { color: '#d32f2f' }]}>Error: {sessionCard.error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.tint }]}
              onPress={loadActiveSession}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : activeSessionId ? (
          // Active Session Card
          <View style={styles.cardContainer}>
            <TouchableOpacity
              style={[styles.sessionCard, { backgroundColor: colors.tint }]}
              onPress={handleOpenSession}
              activeOpacity={0.7}
            >
              <Text style={styles.sessionTitle}>{activeSessionTitle}</Text>
              <Text style={styles.sessionStats}>
                {sessionCard.checkedCount} of {sessionCard.itemCount} items checked
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${sessionCard.itemCount > 0 ? (sessionCard.checkedCount / sessionCard.itemCount) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.tapHint}>Tap to open</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Empty State
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyIcon]}>📦</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Session</Text>
            <Text style={[styles.emptySubtitle, { color: colors.icon }]}>
              Create a new checklist for your next trip
            </Text>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.tint }]}
              onPress={handleCreateSession}
            >
              <Text style={styles.createButtonText}>Create New Session</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Session Form Modal */}
      <SessionFormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  historyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    marginVertical: 32,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardContainer: {
    marginBottom: 16,
  },
  sessionCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sessionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sessionStats: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 3,
  },
  tapHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    maxWidth: 280,
  },
  createButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

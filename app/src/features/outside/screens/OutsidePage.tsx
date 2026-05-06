/**
 * OutsidePage
 * 
 * Main Outside tab view
 * Shows active session with item preview and quick actions
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
import { OutsideSessionItemWithContext } from '../models/OutsideSessionItem';
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

  const handleToggleItem = async (itemId: string) => {
    if (!activeSessionId) return;
    try {
      await outsideService.checkItem(activeSessionId, itemId);
      await loadActiveSession();
    } catch (err) {
      console.error('Error toggling item:', err);
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

  const handleAddItems = () => {
    if (activeSessionId) {
      router.push(`/outside/${activeSessionId}`);
    }
  };

  const handleCompleteSession = () => {
    if (activeSessionId) {
      router.push(`/outside/${activeSessionId}`);
    }
  };

  const handleViewHistory = () => {
    router.push('/outside/history');
  };

  const previewItems = sessionItems.slice(0, 5);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Outside</Text>
          <TouchableOpacity
            style={[styles.historyButton, { backgroundColor: '#0a84ff' }]}
            onPress={handleViewHistory}
          >
            <Text style={[styles.historyButtonText, { color: '#fff' }]}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {sessionCard.loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#0a84ff" />
          </View>
        ) : sessionCard.error ? (
          <View style={styles.centerContainer}>
            <Text style={[styles.errorText, { color: '#d32f2f' }]}>Error: {sessionCard.error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: '#0a84ff' }]}
              onPress={loadActiveSession}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : activeSessionId ? (
          /* Active Session with Preview and Actions */
          <View style={styles.cardContainer}>
            {/* Progress Card */}
            <View style={[styles.sessionCard, { backgroundColor: '#0a84ff' }]}>
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
            </View>

            {/* Item Preview Section */}
            {previewItems.length > 0 && (
              <View style={[styles.previewSection, { borderColor: colors.icon }]}>
                <Text style={[styles.previewTitle, { color: colors.text }]}>Items ({sessionCard.itemCount})</Text>
                <View style={styles.itemsList}>
                  {previewItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.previewItem,
                        { 
                          backgroundColor: Boolean(item.is_checked) ? 'rgba(10, 132, 255, 0.1)' : colors.background,
                          borderBottomColor: colors.icon,
                        }
                      ]}
                      onPress={() => handleToggleItem(item.item_id)}
                    >
                      <View style={styles.itemCheckbox}>
                        <Text style={{ fontSize: 20, color: Boolean(item.is_checked) ? '#0a84ff' : colors.icon }}>
                          {Boolean(item.is_checked) ? '☑' : '☐'}
                        </Text>
                      </View>
                      <View style={styles.itemInfo}>
                        <Text
                          style={[
                            styles.itemName,
                            {
                              color: colors.text,
                              textDecorationLine: Boolean(item.is_checked) ? 'line-through' : 'none',
                            },
                          ]}
                        >
                          {item.item_name}
                        </Text>
                        {item.space_name && (
                          <Text style={[styles.itemSpace, { color: colors.icon }]}>
                            in {item.space_name}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                {sessionCard.itemCount > 5 && (
                  <TouchableOpacity
                    style={styles.viewAllLink}
                    onPress={handleOpenSession}
                  >
                    <Text style={{ color: '#0a84ff', fontSize: 14, fontWeight: '600' }}>
                      View all {sessionCard.itemCount} items →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Quick Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#0a84ff' }]}
                onPress={handleAddItems}
              >
                <Text style={styles.actionButtonText}>+ Add Items</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#0a84ff' }]}
                onPress={handleCompleteSession}
              >
                <Text style={styles.actionButtonText}>✓ Complete Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Empty State */
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyIcon]}>📦</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Session</Text>
            <Text style={[styles.emptySubtitle, { color: colors.icon }]}>
              Create a new checklist for your next trip
            </Text>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: '#0a84ff' }]}
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
        onClose={() => {
          setFormVisible(false);
          loadActiveSession();
        }}
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
    marginBottom: 0,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 3,
  },
  previewSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 12,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  itemsList: {
    marginBottom: 12,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  itemCheckbox: {
    marginRight: 12,
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemSpace: {
    fontSize: 12,
  },
  viewAllLink: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  actionButtonsContainer: {
    gap: 12,
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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

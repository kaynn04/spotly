/**
 * SessionHistoryScreen
 * 
 * View completed sessions
 * 
 * Implementation: T009
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useOutsideService } from '../services/OutsideService';
import { OutsideSession } from '../models/OutsideSession';

export default function SessionHistoryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const outsideService = useOutsideService();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<OutsideSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
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
    Alert.alert('Delete Session', `Delete "${sessionTitle}"? This cannot be undone.`, [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await outsideService.deleteSession(sessionId);
            setSessions(sessions.filter(s => s.id !== sessionId));
          } catch (err) {
            console.error('Error deleting session:', err);
            Alert.alert('Error', 'Failed to delete session');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0a84ff" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backButton, { color: '#0a84ff' }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>History</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: '#d32f2f' }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: '#0a84ff' }]}
            onPress={loadSessions}
          >
            <Text style={[styles.retryButtonText, { color: '#fff' }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backButton, { color: '#0a84ff' }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>History</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Sessions List - Flex Container */}
      <View style={styles.sessionsList}>
        {sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.icon }]}>No completed sessions yet</Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            renderItem={({ item }) => (
              <View
                key={item.id}
                style={[styles.sessionItem, { backgroundColor: colors.background, borderBottomColor: '#e0e0e0' }]}
              >
                <View style={styles.sessionInfo}>
                  <Text style={[styles.sessionTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.sessionDate, { color: colors.icon }]}>
                    {item.completed_at ? formatDate(item.completed_at) : 'N/A'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteSession(item.id, item.title)}
                >
                  <Text style={{ color: '#d32f2f', fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            keyExtractor={item => item.id}
            scrollEnabled={true}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sessionsList: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
});

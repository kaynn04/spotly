/**
 * Home Dashboard Screen
 *
 * Primary landing page showing:
 * - Welcome header
 * - Quick statistics cards (items, spaces, containers)
 * - Recent items section (5 most recent)
 * - Empty state when no spaces created yet
 *
 * Feature: 008 - Dashboard Navigation Structure
 * Task: T002 - Create Home Dashboard Screen
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { DashboardService } from '@/src/services/DashboardService';
import { ItemRepository } from '@/src/repositories/ItemRepository';
import { SpaceRepository } from '@/src/repositories/SpaceRepository';
import { ContainerRepository } from '@/src/repositories/ContainerRepository';
import type { Dashboard } from '@/src/services/DashboardService';

/**
 * StatCard - Reusable statistics card component
 */
interface StatCardProps {
  label: string;
  value: number;
  icon: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon }) => (
  <View style={styles.statCard}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/**
 * HomeScreen - Main dashboard component
 */
export default function HomeScreen() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize DashboardService once on mount
  useEffect(() => {
    DashboardService.initialize(
      ItemRepository,
      SpaceRepository,
      ContainerRepository
    );
  }, []);

  // Fetch dashboard data whenever screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const loadDashboard = async () => {
        try {
          setLoading(true);
          const data = await DashboardService.getFullDashboard();
          setDashboard(data);
        } catch (error) {
          console.error('[HomeScreen] Error loading dashboard:', error);
          // Set empty state on error
          setDashboard({
            recentItems: [],
            stats: { totalItems: 0, totalSpaces: 0, totalContainers: 0 },
            isEmpty: true,
          });
        } finally {
          setLoading(false);
        }
      };

      loadDashboard();
    }, [])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0a84ff" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state when no spaces created
  if (dashboard?.isEmpty) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>📱</Text>
            <Text style={styles.title}>Welcome to Spotly</Text>
          </View>

          {/* Empty State Content */}
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No spaces yet</Text>
            <Text style={styles.emptyDescription}>
              Create one to get started!
            </Text>
            <Text style={styles.emptyHint}>
              Tap the &quot;Spaces&quot; tab to create your first space and start
              organizing your belongings.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Full dashboard view
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>📱</Text>
          <Text style={styles.title}>Dashboard</Text>
        </View>

        {/* Statistics Cards Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="📦"
              value={dashboard?.stats.totalItems ?? 0}
              label="Items"
            />
            <StatCard
              icon="🏠"
              value={dashboard?.stats.totalSpaces ?? 0}
              label="Spaces"
            />
            <StatCard
              icon="📂"
              value={dashboard?.stats.totalContainers ?? 0}
              label="Containers"
            />
          </View>
        </View>

        {/* Recent Items Section */}
        {dashboard?.recentItems && dashboard.recentItems.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recently Added</Text>
            <View style={styles.itemsList}>
              {dashboard.recentItems.map((item) => (
                <View key={item.id} style={styles.recentItem}>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemSpace}>• {item.spaceName}</Text>
                  </View>
                  <Text style={styles.itemIcon}>✓</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Lending Placeholder */}
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderIcon}>🤝</Text>
          <Text style={styles.placeholderTitle}>Lending Tracker</Text>
          <Text style={styles.placeholderText}>Coming soon</Text>
        </View>

        {/* Outside Items Placeholder */}
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderIcon}>🧳</Text>
          <Text style={styles.placeholderTitle}>Outside Items</Text>
          <Text style={styles.placeholderText}>Coming soon</Text>
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Styles for Home Dashboard
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  /* Header */
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },

  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },

  /* Statistics Section */
  statsSection: {
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },

  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },

  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0a84ff',
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  /* Recent Items Section */
  recentSection: {
    marginBottom: 28,
  },

  itemsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },

  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  itemContent: {
    flex: 1,
  },

  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },

  itemSpace: {
    fontSize: 12,
    color: '#999',
  },

  itemIcon: {
    fontSize: 16,
    color: '#0a84ff',
    marginLeft: 12,
  },

  /* Placeholder Cards */
  placeholderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  placeholderIcon: {
    fontSize: 40,
    marginBottom: 12,
  },

  placeholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },

  placeholderText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },

  emptyEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },

  emptyDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    fontWeight: '500',
  },

  emptyHint: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },

  /* Bottom Padding */
  bottomPadding: {
    height: 40,
  },
});

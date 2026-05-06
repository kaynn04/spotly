/**
 * Tab Navigation Layout
 *
 * Bottom tab navigation with 4 main sections:
 * - Home: Dashboard overview
 * - Spaces: Space management
 * - Lending: Lending feature (placeholder)
 * - Outside: Outside items feature (placeholder)
 *
 * Feature: 008 - Dashboard Navigation Structure
 * Task: T001 - Tab Navigation Layout + T006 - Enhanced Styling
 */

import { Tabs } from 'expo-router';
import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * TabIcon - Consistent icon rendering with active state styling
 */
interface TabIconProps {
  emoji: string;
  color: string;
}

const TabIcon: React.FC<TabIconProps> = ({ emoji, color }) => (
  <View style={styles.iconContainer}>
    <Text style={[styles.icon, { color }]}>{emoji}</Text>
  </View>
);

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        tabBarPosition: 'bottom',
        tabBarStyle: [styles.tabBar, { paddingBottom: insets.bottom + 8 }],
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarActiveTintColor: '#0a84ff',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
        tabBarHideOnKeyboard: false,
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} />,
        }}
      />

      {/* Spaces Tab */}
      <Tabs.Screen
        name="spaces"
        options={{
          title: 'Spaces',
          tabBarLabel: 'Spaces',
          tabBarIcon: ({ color }) => <TabIcon emoji="📚" color={color} />,
        }}
      />

      {/* Lending Tab */}
      <Tabs.Screen
        name="lending"
        options={{
          title: 'Lending',
          tabBarLabel: 'Lending',
          tabBarIcon: ({ color }) => <TabIcon emoji="🤝" color={color} />,
        }}
      />

      {/* Outside Tab */}
      <Tabs.Screen
        name="outside"
        options={{
          title: 'Outside',
          tabBarLabel: 'Outside',
          tabBarIcon: ({ color }) => <TabIcon emoji="🧳" color={color} />,
        }}
      />
    </Tabs>
  );
}

/**
 * Styles for Tab Navigation
 */
const styles = StyleSheet.create({
  tabBar: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 72,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },

  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.2,
  },

  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
  },

  icon: {
    fontSize: 24,
  },
});

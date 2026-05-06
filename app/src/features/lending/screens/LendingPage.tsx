/**
 * Lending Page
 *
 * Placeholder screen for the Lending feature (coming soon).
 * Displays a simple, centered message indicating the feature is under development.
 *
 * Feature: 008 - Dashboard Navigation Structure
 * Task: T004 - Lending Placeholder Screen
 */

import React from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';

/**
 * LendingPage - Lending feature placeholder
 * Shows centered "Coming Soon" message with icon
 */
export default function LendingPage() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Content Area - Centered */}
      <View style={styles.content}>
        {/* Icon */}
        <Text style={styles.icon}>🤝</Text>

        {/* Title */}
        <Text style={styles.title}>Lending Feature</Text>

        {/* Description */}
        <Text style={styles.message}>Coming soon</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>Track items you've lent to others</Text>
      </View>
    </SafeAreaView>
  );
}

/**
 * Styles for Lending Page
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  icon: {
    fontSize: 64,
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },

  message: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

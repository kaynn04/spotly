/**
 * Lending Detail Route
 *
 * Dynamic route handler for /lending/[id]
 * Extracts lending ID from route params and renders LendingDetailScreen
 *
 * Feature: 009 - Lending Tracker
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import LendingDetailScreen from '@/src/features/lending/screens/LendingDetailScreen.tsx';

export default function LendingDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <LendingDetailScreen lendingId={id} />;
}

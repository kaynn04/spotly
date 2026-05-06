/**
 * Outside Session Detail Route
 *
 * Dynamic route handler for /outside/[id]
 * Extracts session ID from route params and renders SessionDetailScreen
 *
 * Feature: 010 - Outside Checklist
 * Implementation: T013
 */

import React from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import SessionDetailScreen from '@/src/features/outside/screens/SessionDetailScreen';

export default function OutsideSessionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SessionDetailScreen />
    </>
  );
}

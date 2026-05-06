/**
 * Session Detail Route Handler
 * 
 * Renders SessionDetailScreen for a specific session
 * 
 * Implementation: T013
 */

import React from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import SessionDetailScreen from '@/src/features/outside/screens/SessionDetailScreen';

export default function SessionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SessionDetailScreen />
    </>
  );
}

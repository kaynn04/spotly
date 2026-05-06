/**
 * Session History Route Handler
 * 
 * Renders SessionHistoryScreen
 * 
 * Implementation: T014
 */

import React from 'react';
import { Stack } from 'expo-router';
import SessionHistoryScreen from '@/src/features/outside/screens/SessionHistoryScreen';

export default function SessionHistoryRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SessionHistoryScreen />
    </>
  );
}

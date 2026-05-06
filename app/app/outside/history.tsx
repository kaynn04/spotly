/**
 * Outside Session History Route
 *
 * Route handler for /outside/history
 * Renders SessionHistoryScreen
 *
 * Feature: 010 - Outside Checklist
 * Implementation: T014
 */

import React from 'react';
import { Stack } from 'expo-router';
import SessionHistoryScreen from '@/src/features/outside/screens/SessionHistoryScreen';

export default function OutsideHistoryRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SessionHistoryScreen />
    </>
  );
}

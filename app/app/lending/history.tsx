/**
 * Lending History Route
 *
 * Route handler for /lending/history
 * Renders LendingHistoryScreen showing all lendings with filtering
 *
 * Feature: 009 - Lending Tracker
 */

import React from 'react';
import LendingHistoryScreen from '@/src/features/lending/screens/LendingHistoryScreen';

export default function LendingHistoryRoute() {
  return <LendingHistoryScreen />;
}

/**
 * Tab Navigation Layout
 *
 * Floating pill navbar (icon-only) that hides on scroll-down.
 * The navigator's tab bar wrapper is made invisible via tabBarStyle
 * so only our custom pill shows — no background bleed.
 */

import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import FloatingTabBar from '@/components/ui/FloatingTabBar';
import { ScrollHideProvider } from '@/hooks/use-scroll-hide';

export default function TabLayout() {
  return (
    <ScrollHideProvider>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // Make the navigator's tab bar wrapper invisible.
          // Our FloatingTabBar is position:absolute inside it,
          // so collapsing the wrapper means no background shows.
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 0,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            ...(Platform.OS === 'web' ? { overflow: 'visible' } : {}),
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="spaces" options={{ title: 'Spaces' }} />
        <Tabs.Screen name="lending" options={{ title: 'Lending' }} />
        <Tabs.Screen name="outside" options={{ title: 'Outside' }} />
      </Tabs>
    </ScrollHideProvider>
  );
}

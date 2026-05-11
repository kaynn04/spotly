/**
 * Tab Navigation Layout
 *
 * Floating pill navbar (icon-only) that hides on scroll-down.
 * The navigator's tab bar wrapper is made invisible via tabBarStyle
 * so only our custom pill shows — no background bleed.
 */

import { Tabs } from 'expo-router';
import React, { useRef } from 'react';
import { Platform } from 'react-native';
import FloatingTabBar, { type TabBarHandle } from '@/components/ui/FloatingTabBar';
import { ScrollHideProvider } from '@/hooks/use-scroll-hide';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { WalkthroughProvider } from '@/src/features/walkthrough/context/WalkthroughContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bg = isDark ? '#000000' : '#f8f9fa';
  const tabBarRef = useRef<TabBarHandle>(null);

  return (
    <WalkthroughProvider tabBarRef={tabBarRef}>
    <ScrollHideProvider>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} ref={tabBarRef} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: bg },
          lazy: false,
          animation: 'fade',
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
    </WalkthroughProvider>
  );
}

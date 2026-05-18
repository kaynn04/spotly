import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeDatabase } from '@/src/db/migrations';
import { isOnboardingDone } from './onboarding';
import { ColorSchemeProvider } from '@/src/context/ColorSchemeContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [dbReady, setDbReady] = useState(false);
  const [navChecked, setNavChecked] = useState(false);

  const isDark = colorScheme === 'dark';
  const navBg = isDark ? '#000000' : '#f8f9fa';

  // Keep system bar backgrounds in sync with color scheme
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(navBg);
  }, [navBg]);

  // Effect 1: Initialize DB — blocks rendering until done
  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();
        console.log('✓ Database initialized');
      } catch (err) {
        console.error('✗ Database init failed:', err);
        // Still allow app to load even if DB fails
      } finally {
        setDbReady(true);
      }
    };
    init();
  }, []);

  // Effect 2: Check onboarding only after Stack is mounted (dbReady = true)
  useEffect(() => {
    if (!dbReady) return;
    const checkOnboarding = async () => {
      try {
        const done = await isOnboardingDone();
        if (!done) {
          router.replace('/onboarding');
        }
      } catch (err) {
        console.error('✗ Onboarding check failed:', err);
      } finally {
        setNavChecked(true);
      }
    };
    checkOnboarding();
  }, [dbReady, router]);

  // Effect 3: Notification deep-link
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const lendingId = data?.lendingId as string | undefined;
      const itemId = data?.itemId as string | undefined;
      if (lendingId) {
        router.push(`/lending/${lendingId}` as any);
        return;
      }
      if (itemId) router.push(`/item/${itemId}` as any);
    });
    return () => sub.remove();
  }, [router]);

  if (!dbReady) return null;

  const theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: navBg,
      card: navBg,
    },
  };

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <ColorSchemeProvider>
      <ThemeProvider value={theme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: navBg },
            animation: 'slide_from_right',
            animationDuration: 250,
            navigationBarColor: navBg,
            gestureEnabled: true,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
          <Stack.Screen name="space/[id]" />
          <Stack.Screen name="container/[id]" />
          <Stack.Screen name="item/[id]" />
          <Stack.Screen name="lending/[id]" />
          <Stack.Screen name="lending/history" />
          <Stack.Screen name="outside/[id]" />
          <Stack.Screen name="outside/history" />
          <Stack.Screen name="tools/warranty-tracker" />
          <Stack.Screen name="settings" />
        </Stack>
        <StatusBar style="auto" backgroundColor={navBg} translucent={false} />
      </ThemeProvider>
    </ColorSchemeProvider>
    </SafeAreaProvider>
  );
}

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeDatabase } from '@/src/db/migrations';
import { isOnboardingDone } from './onboarding';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [dbReady, setDbReady] = useState(false);
  const [navChecked, setNavChecked] = useState(false);

  // Effect 1: Initialize DB — blocks rendering until done
  useEffect(() => {
    initializeDatabase()
      .catch((err) => console.error('Failed to initialize database:', err))
      .finally(() => setDbReady(true));
  }, []);

  // Effect 2: Check onboarding only after Stack is mounted (dbReady = true)
  useEffect(() => {
    if (!dbReady) return;
    isOnboardingDone().then((done) => {
      if (!done) router.replace('/onboarding');
      setNavChecked(true);
    });
  }, [dbReady]);

  if (!dbReady) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="space/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="container/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="item/[id]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

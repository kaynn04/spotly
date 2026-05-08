import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

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

  const isDark = colorScheme === 'dark';
  const navBg = isDark ? '#000000' : '#f8f9fa';

  const theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: navBg,
      card: navBg,
    },
  };

  return (
    <ColorSchemeProvider>
      <ThemeProvider value={theme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: navBg },
            animation: 'slide_from_right',
            animationDuration: 250,
            navigationBarColor: navBg,
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
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </ColorSchemeProvider>
  );
}

import React, { createContext, useContext, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';

const STORAGE_KEY = '@spotly/color-scheme';

function setNativeBg(scheme: 'light' | 'dark') {
  try {
    SystemUI.setBackgroundColorAsync(scheme === 'dark' ? '#000000' : '#f8f9fa').catch(err => {
      console.warn('SystemUI background color not available:', err);
    });
  } catch (err) {
    console.warn('SystemUI background color failed:', err);
  }
}

const ColorSchemeToggleContext = createContext<() => void>(() => {});

export function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
  // Restore saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light') {
        Appearance.setColorScheme(saved);
        setNativeBg(saved);
      } else {
        // No saved preference — follow OS
        setNativeBg(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
      }
    });
  }, []);

  // Keep native bg in sync when OS scheme changes externally
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setNativeBg(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const toggle = () => {
    const current = Appearance.getColorScheme();
    const next = current === 'dark' ? 'light' : 'dark';
    Appearance.setColorScheme(next);
    setNativeBg(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <ColorSchemeToggleContext.Provider value={toggle}>
      {children}
    </ColorSchemeToggleContext.Provider>
  );
}

export function useToggleColorScheme() {
  return useContext(ColorSchemeToggleContext);
}

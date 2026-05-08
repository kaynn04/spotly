/**
 * FloatingTabBar
 *
 * Floating pill bottom navbar — icon-only, centered, with active dot.
 * Hides on scroll-down, reappears on scroll-up via spring animation.
 *
 * Rendered via the `tabBar` prop of <Tabs>. The navigator's wrapper is
 * made transparent + absolute via tabBarStyle in _layout.tsx so no
 * background bleeds through.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faHome, faBook, faHandshake, faSuitcase } from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScrollHide } from '@/hooks/use-scroll-hide';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const PRIMARY = '#6b7f99';

const TAB_ICONS: Record<string, any> = {
  index: faHome,
  spaces: faBook,
  lending: faHandshake,
  outside: faSuitcase,
};

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { translateY } = useScrollHide();

  const bg = isDark ? '#1c1c1e' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const shadow = isDark ? '#000' : '#64748b';

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          bottom: insets.bottom + 12,
          backgroundColor: bg,
          borderColor: border,
          shadowColor: shadow,
          transform: [{ translateY }],
        },
      ]}
    >
      {state.routes.map((route, idx) => {
        const focused = state.index === idx;
        const icon = TAB_ICONS[route.name];

        return (
          <TabItem
            key={route.key}
            icon={icon}
            focused={focused}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
          />
        );
      })}
    </Animated.View>
  );
}

/** Animated tab item with smooth scale + opacity transitions */
function TabItem({ icon, focused, onPress }: { icon: any; focused: boolean; onPress: () => void }) {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [focused]);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  return (
    <Pressable onPress={onPress} style={styles.tab}>
      <Animated.View style={[styles.iconBg, { transform: [{ scale }] }]}>
        {/* Highlight circle — opacity-only animation avoids color-interpolation white flash */}
        <Animated.View style={[styles.iconBgHighlight, { opacity: anim }]} />
        <FontAwesomeIcon
          icon={icon}
          size={18}
          color={focused ? PRIMARY : '#999'}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.dot,
          {
            opacity: anim,
            transform: [{ scale: anim }],
          },
        ]}
      />
    </Pressable>
  );
}

/** Height of the floating pill navbar */
export const TAB_BAR_HEIGHT = 60;
/** Gap between the pill and the device bottom safe area */
export const TAB_BAR_OFFSET = 12;

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 4,
    // Shadow
    elevation: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 4,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBgHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: `${PRIMARY}15`,
  },
  icon: {
    fontSize: 21,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PRIMARY,
  },
});

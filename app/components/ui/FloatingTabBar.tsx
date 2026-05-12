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

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  Animated,
  View,
  Pressable,
  StyleSheet,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import type { SpotlightRect } from '@/src/features/walkthrough/models/WalkthroughStep';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faHome, faBook, faHandshake, faSuitcase, faMicrophone } from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScrollHide } from '@/hooks/use-scroll-hide';
import { useRouter } from 'expo-router';
import VoiceModal from '@/src/features/voice/screens/components/VoiceModal';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export interface TabBarHandle {
  measureTab(key: string): Promise<SpotlightRect>;
}

const PRIMARY = '#6b7f99';

const TAB_ICONS: Record<string, any> = {
  index: faHome,
  spaces: faBook,
  lending: faHandshake,
  outside: faSuitcase,
};

const FloatingTabBar = forwardRef<TabBarHandle, BottomTabBarProps>(function FloatingTabBar({ state, navigation }, ref) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { translateY } = useScrollHide();
  const router = useRouter();
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Listen for hide/show events (e.g. multi-select mode)
  useEffect(() => {
    const showSub = DeviceEventEmitter.addListener('spotly:show-tab-bar', () => setHidden(false));
    const hideSub = DeviceEventEmitter.addListener('spotly:hide-tab-bar', () => setHidden(true));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const bg = isDark ? '#1c1c1e' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const shadow = isDark ? '#000' : '#64748b';

  // Insert mic button in the center (after index 1 = Spaces)
  const centerIndex = 2;

  const tabRefs = useRef<Record<string, View | null>>({});
  const micRef = useRef<View | null>(null);

  useImperativeHandle(ref, () => ({
    measureTab(key: string): Promise<SpotlightRect> {
      return new Promise((resolve, reject) => {
        let target: View | null = null;
        if (key === 'tab-mic') target = micRef.current;
        else if (key === 'tab-spaces') target = tabRefs.current['spaces'];
        else if (key === 'tab-lending') target = tabRefs.current['lending'];
        else if (key === 'tab-outside') target = tabRefs.current['outside'];
        else if (key === 'tab-home') target = tabRefs.current['index'];
        if (!target) { reject(new Error(`No ref for key: ${key}`)); return; }
        target.measure((_, __, width, height, pageX, pageY) => {
          resolve({ x: pageX, y: pageY, width, height });
        });
      });
    },
  }));

  return (
    <>
      {!hidden && (
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

          const tabItem = (
            <TabItem
              key={route.key}
              icon={icon}
              focused={focused}
              tabRef={(el) => { tabRefs.current[route.name] = el; }}
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

          // Insert mic button before the centerIndex tab
          if (idx === centerIndex) {
            return (
              <React.Fragment key={`mic-${route.key}`}>
                <MicButton onPress={() => setShowVoiceModal(true)} micRef={micRef} />
                {tabItem}
              </React.Fragment>
            );
          }

          return tabItem;
        })}
      </Animated.View>
      )}

      <VoiceModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onItemAdded={() => {
          DeviceEventEmitter.emit('spotly:refresh-home');
        }}
        onSpaceCreated={() => {
          DeviceEventEmitter.emit('spotly:refresh-home');
        }}
        onNavigateToItem={(itemId) => {
          setShowVoiceModal(false);
          router.push({ pathname: '../item/[id]' as any, params: { id: itemId } });
        }}
      />
    </>
  );
});

export default FloatingTabBar;

/** Center mic button — raised above the pill */
function MicButton({ onPress, micRef }: { onPress: () => void; micRef?: React.RefObject<View | null> }) {
  return (
    <Pressable onPress={onPress} style={styles.micTab}>
      <View ref={micRef} style={styles.micButton}>
        <FontAwesomeIcon icon={faMicrophone} size={20} color="#fff" />
      </View>
    </Pressable>
  );
}

/** Animated tab item with smooth scale + opacity transitions */
function TabItem({ icon, focused, onPress, tabRef }: { icon: any; focused: boolean; onPress: () => void; tabRef?: (el: View | null) => void }) {
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
    <Pressable ref={tabRef} onPress={onPress} style={styles.tab}>
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
  micTab: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingHorizontal: 4,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
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

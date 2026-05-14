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
  Modal,
  Text,
  TouchableWithoutFeedback,
} from 'react-native';
import type { SpotlightRect } from '@/src/features/walkthrough/models/WalkthroughStep';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faHome, faBook, faHandshake, faWrench, faPlus, faTimes, faBoxOpen, faCube, faBox } from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScrollHide } from '@/hooks/use-scroll-hide';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export interface TabBarHandle {
  measureTab(key: string): Promise<SpotlightRect>;
}

const PRIMARY = '#6b7f99';

const TAB_ICONS: Record<string, any> = {
  index: faHome,
  spaces: faBook,
  lending: faHandshake,
  outside: faWrench,
};

const FloatingTabBar = forwardRef<TabBarHandle, BottomTabBarProps>(function FloatingTabBar({ state, navigation }, ref) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { translateY } = useScrollHide();
  const router = useRouter();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Listen for hide/show events (e.g. multi-select mode)
  useEffect(() => {
    const showSub = DeviceEventEmitter.addListener('synop:show-tab-bar', () => setHidden(false));
    const hideSub = DeviceEventEmitter.addListener('synop:hide-tab-bar', () => setHidden(true));
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

          // Insert + button before the centerIndex tab
          if (idx === centerIndex) {
            return (
              <React.Fragment key={`plus-${route.key}`}>
                <PlusButton onPress={() => setShowAddSheet(true)} plusRef={micRef} />
                {tabItem}
              </React.Fragment>
            );
          }

          return tabItem;
        })}
      </Animated.View>
      )}

      <AddActionsSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSelect={(action) => {
          setShowAddSheet(false);
          if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (action === 'space') {
            router.push({ pathname: '/(tabs)/spaces' as any, params: { openCreate: '1' } });
          } else if (action === 'container') {
            router.push('/(tabs)/spaces' as any);
          } else if (action === 'item') {
            router.push('/(tabs)/spaces' as any);
          } else if (action === 'lend') {
            router.push({ pathname: '/(tabs)/lending' as any, params: { openCreate: '1' } });
          }
        }}
      />
    </>
  );
});

export default FloatingTabBar;

/** Center + button — raised above the pill */
function PlusButton({ onPress, plusRef }: { onPress: () => void; plusRef?: React.RefObject<View | null> }) {
  return (
    <Pressable onPress={onPress} style={styles.micTab}>
      <View ref={plusRef} style={styles.micButton}>
        <FontAwesomeIcon icon={faPlus} size={20} color="#fff" />
      </View>
    </Pressable>
  );
}

type AddAction = 'space' | 'container' | 'item' | 'lend';

const ADD_ACTIONS: { action: AddAction; icon: any; label: string; description: string }[] = [
  { action: 'space', icon: faBox, label: 'Add Space', description: 'Create a new storage space' },
  { action: 'container', icon: faBoxOpen, label: 'Add Container', description: 'Add a container inside a space' },
  { action: 'item', icon: faCube, label: 'Add Item', description: 'Track a new item' },
  { action: 'lend', icon: faHandshake, label: 'Lend', description: 'Lend an item to someone' },
];

function AddActionsSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: AddAction) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [visible]);

  const bg = isDark ? '#1c1c1e' : '#ffffff';
  const border = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#8e8e93';
  const textColor = isDark ? '#ffffff' : '#1c1c1e';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sheetStyles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                sheetStyles.sheet,
                {
                  backgroundColor: bg,
                  paddingBottom: insets.bottom + 16,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Handle */}
              <View style={[sheetStyles.handle, { backgroundColor: border }]} />

              {/* Header */}
              <View style={sheetStyles.header}>
                <Text style={[sheetStyles.title, { color: textColor }]}>Add New</Text>
                <Pressable onPress={onClose} style={sheetStyles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <FontAwesomeIcon icon={faTimes} size={14} color={subtleText} />
                </Pressable>
              </View>

              {/* Actions */}
              {ADD_ACTIONS.map(({ action, icon, label, description }) => (
                <Pressable
                  key={action}
                  style={({ pressed }) => [
                    sheetStyles.actionRow,
                    { borderBottomColor: border, opacity: pressed ? 0.6 : 1 },
                  ]}
                  onPress={() => onSelect(action)}
                >
                  <View style={[sheetStyles.actionIcon, { backgroundColor: `${PRIMARY}15` }]}>
                    <FontAwesomeIcon icon={icon} size={16} color={PRIMARY} />
                  </View>
                  <View style={sheetStyles.actionText}>
                    <Text style={[sheetStyles.actionLabel, { color: textColor }]}>{label}</Text>
                    <Text style={[sheetStyles.actionDesc, { color: subtleText }]}>{description}</Text>
                  </View>
                </Pressable>
              ))}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
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

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionDesc: {
    fontSize: 12,
  },
});

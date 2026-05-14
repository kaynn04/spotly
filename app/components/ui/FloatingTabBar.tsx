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
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { SpotlightRect } from '@/src/features/walkthrough/models/WalkthroughStep';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faHome, faBook, faHandshake, faWrench, faPlus, faTimes, faBoxOpen, faCube, faBox, faMapPin, faFolder, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScrollHide } from '@/hooks/use-scroll-hide';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { Space } from '@/src/models/Space';
import type { Container } from '@/src/models/Container';
import { SpaceService } from '@/src/services/SpaceService';
import { ContainerService } from '@/src/services/ContainerService';

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

type SheetStep = 'actions' | 'pick-space' | 'pick-location';
type AddAction = 'space' | 'container' | 'item' | 'lend';

const ADD_ACTIONS: { action: AddAction; icon: any; label: string; description: string }[] = [
  { action: 'space',     icon: faBox,       label: 'Add Space',      description: 'Create a new storage space' },
  { action: 'container', icon: faBoxOpen,   label: 'Add Container',  description: 'Add a container inside a space' },
  { action: 'item',      icon: faCube,      label: 'Add Item',       description: 'Track a new item' },
  { action: 'lend',      icon: faHandshake, label: 'Lend',           description: 'Lend an item to someone' },
];

const FloatingTabBar = forwardRef<TabBarHandle, BottomTabBarProps>(function FloatingTabBar({ state, navigation }, ref) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { translateY } = useScrollHide();
  const router = useRouter();

  const [showSheet, setShowSheet] = useState(false);
  const [sheetStep, setSheetStep] = useState<SheetStep>('actions');
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [spaceContainers, setSpaceContainers] = useState<Record<string, Container[]>>({});
  const [pickerLoading, setPickerLoading] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const showSub = DeviceEventEmitter.addListener('synop:show-tab-bar', () => setHidden(false));
    const hideSub = DeviceEventEmitter.addListener('synop:hide-tab-bar', () => setHidden(true));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const bg = isDark ? '#1c1c1e' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const shadow = isDark ? '#000' : '#64748b';
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

  function openSheet() {
    setSheetStep('actions');
    setShowSheet(true);
  }

  /** Close sheet and optionally execute a callback after the close animation */
  function closeSheet(then?: () => void) {
    setShowSheet(false);
    if (then) setTimeout(then, 270);
  }

  async function handleAction(action: AddAction) {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (action === 'space') {
      closeSheet(() => router.push({ pathname: '/(tabs)/spaces' as any, params: { openCreate: '1' } }));
    } else if (action === 'lend') {
      closeSheet(() => router.push({ pathname: '/(tabs)/lending' as any, params: { openCreate: '1' } }));
    } else if (action === 'container') {
      setPickerLoading(true);
      setSheetStep('pick-space');
      try {
        setAllSpaces(await SpaceService.getAllSpaces());
      } finally {
        setPickerLoading(false);
      }
    } else if (action === 'item') {
      setPickerLoading(true);
      setSheetStep('pick-location');
      try {
        const spaces = await SpaceService.getAllSpaces();
        const map: Record<string, Container[]> = {};
        await Promise.all(spaces.map(async (s) => {
          map[s.id] = await ContainerService.getContainersBySpaceId(s.id);
        }));
        setAllSpaces(spaces);
        setSpaceContainers(map);
      } finally {
        setPickerLoading(false);
      }
    }
  }

  function handleSpaceSelect(spaceId: string) {
    closeSheet(() => router.push({ pathname: '/space/[id]' as any, params: { id: spaceId, openAddContainer: '1' } }));
  }

  function handleLocationSelect(spaceId: string, containerId: string | null) {
    if (containerId) {
      closeSheet(() => router.push({ pathname: '/container/[id]' as any, params: { id: containerId, openAddItem: '1' } }));
    } else {
      closeSheet(() => router.push({ pathname: '/space/[id]' as any, params: { id: spaceId, openAddItem: '1' } }));
    }
  }

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

          if (idx === centerIndex) {
            return (
              <React.Fragment key={`plus-${route.key}`}>
                <PlusButton onPress={openSheet} plusRef={micRef} />
                {tabItem}
              </React.Fragment>
            );
          }

          return tabItem;
        })}
      </Animated.View>
      )}

      <AddActionsSheet
        visible={showSheet}
        step={sheetStep}
        allSpaces={allSpaces}
        spaceContainers={spaceContainers}
        pickerLoading={pickerLoading}
        onClose={() => closeSheet()}
        onAction={handleAction}
        onBack={() => setSheetStep('actions')}
        onSpaceSelect={handleSpaceSelect}
        onLocationSelect={handleLocationSelect}
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

function AddActionsSheet({
  visible,
  step,
  allSpaces,
  spaceContainers,
  pickerLoading,
  onClose,
  onAction,
  onBack,
  onSpaceSelect,
  onLocationSelect,
}: {
  visible: boolean;
  step: SheetStep;
  allSpaces: Space[];
  spaceContainers: Record<string, Container[]>;
  pickerLoading: boolean;
  onClose: () => void;
  onAction: (action: AddAction) => void;
  onBack: () => void;
  onSpaceSelect: (spaceId: string) => void;
  onLocationSelect: (spaceId: string, containerId: string | null) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setModalVisible(false));
    }
  }, [visible]);

  const bg = isDark ? '#1c1c1e' : '#ffffff';
  const border = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = '#8e8e93';
  const textColor = isDark ? '#ffffff' : '#1c1c1e';
  const stepTitle = step === 'pick-space' ? 'Select Space' : step === 'pick-location' ? 'Select Location' : 'Add New';

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onClose}>
      {/* Dimmed overlay — tap to dismiss */}
      <Animated.View style={[StyleSheet.absoluteFill, sheetStyles.overlayBg, { opacity: overlayAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        style={[
          sheetStyles.sheet,
          { backgroundColor: bg, paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[sheetStyles.handle, { backgroundColor: border }]} />

        {/* Header */}
        <View style={sheetStyles.header}>
          {step !== 'actions' ? (
            <Pressable onPress={onBack} style={sheetStyles.sideBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesomeIcon icon={faChevronLeft} size={14} color={subtleText} />
            </Pressable>
          ) : (
            <View style={sheetStyles.sideBtn} />
          )}
          <Text style={[sheetStyles.title, { color: textColor }]}>{stepTitle}</Text>
          <Pressable onPress={onClose} style={sheetStyles.sideBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesomeIcon icon={faTimes} size={14} color={subtleText} />
          </Pressable>
        </View>

        {/* Step: main actions */}
        {step === 'actions' && ADD_ACTIONS.map(({ action, icon, label, description }) => (
          <Pressable
            key={action}
            style={({ pressed }) => [sheetStyles.actionRow, { borderBottomColor: border, opacity: pressed ? 0.6 : 1 }]}
            onPress={() => onAction(action)}
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

        {/* Step: pick space for container */}
        {step === 'pick-space' && (
          pickerLoading ? (
            <View style={sheetStyles.loadingBox}><ActivityIndicator size="small" color={PRIMARY} /></View>
          ) : (
            <ScrollView style={sheetStyles.pickerScroll} showsVerticalScrollIndicator={false}>
              {allSpaces.length === 0
                ? <Text style={[sheetStyles.emptyText, { color: subtleText }]}>No spaces yet. Create a space first.</Text>
                : allSpaces.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[sheetStyles.pickerRow, { borderBottomColor: border }]}
                    onPress={() => onSpaceSelect(s.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[sheetStyles.pickerIcon, { backgroundColor: `${PRIMARY}15` }]}>
                      <FontAwesomeIcon icon={faBox} size={15} color={PRIMARY} />
                    </View>
                    <Text style={[sheetStyles.pickerLabel, { color: textColor }]}>{s.name}</Text>
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
          )
        )}

        {/* Step: pick location for item */}
        {step === 'pick-location' && (
          pickerLoading ? (
            <View style={sheetStyles.loadingBox}><ActivityIndicator size="small" color={PRIMARY} /></View>
          ) : (
            <ScrollView style={sheetStyles.pickerScroll} showsVerticalScrollIndicator={false}>
              {allSpaces.length === 0
                ? <Text style={[sheetStyles.emptyText, { color: subtleText }]}>No spaces yet. Create a space first.</Text>
                : allSpaces.map((s) => {
                  const containers = spaceContainers[s.id] ?? [];
                  return (
                    <View key={s.id}>
                      <Text style={[sheetStyles.pickerSectionLabel, { color: subtleText }]}>{s.name.toUpperCase()}</Text>
                      {/* Space root */}
                      <TouchableOpacity
                        style={[sheetStyles.pickerRow, { borderBottomColor: border }]}
                        onPress={() => onLocationSelect(s.id, null)}
                        activeOpacity={0.7}
                      >
                        <View style={[sheetStyles.pickerIcon, { backgroundColor: `${PRIMARY}15` }]}>
                          <FontAwesomeIcon icon={faMapPin} size={15} color={PRIMARY} />
                        </View>
                        <Text style={[sheetStyles.pickerLabel, { color: textColor }]}>{s.name} (root)</Text>
                      </TouchableOpacity>
                      {/* Containers inside */}
                      {containers.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={[sheetStyles.pickerRow, sheetStyles.pickerRowIndented, { borderBottomColor: border }]}
                          onPress={() => onLocationSelect(s.id, c.id)}
                          activeOpacity={0.7}
                        >
                          <View style={[sheetStyles.pickerIcon, { backgroundColor: `${PRIMARY}15` }]}>
                            <FontAwesomeIcon icon={faFolder} size={15} color={PRIMARY} />
                          </View>
                          <Text style={[sheetStyles.pickerLabel, { color: textColor }]}>{c.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })
              }
            </ScrollView>
          )
        )}
      </Animated.View>
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
  overlayBg: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
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
  sideBtn: {
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
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  pickerScroll: {
    maxHeight: 340,
  },
  pickerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  pickerRowIndented: {
    paddingLeft: 36,
  },
  pickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 24,
  },
});

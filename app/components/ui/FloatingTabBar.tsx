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
import { faHome, faBook, faHandshake, faWrench, faPlus, faTimes, faBoxOpen, faCube, faBox, faMapPin, faFolder, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
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

  // Reset sheet step when sheet closes
  useEffect(() => {
    if (!showSheet) {
      setSheetStep('actions');
    }
  }, [showSheet]);

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

  /** Close sheet, wait for animation to finish, then run callback */
  function closeSheet(then?: () => void) {
    setShowSheet(false);
    // Wait for the close animation (220ms) to finish before navigating
    if (then) setTimeout(then, 300);
  }

  async function handleAction(action: AddAction) {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (action === 'space') {
      // Navigate immediately so SpacesPage starts mounting while the sheet animates closed.
      // Emit the event in the closeSheet callback (~300 ms later) so the listener is registered.
      navigation.navigate('spaces');
      closeSheet(() => DeviceEventEmitter.emit('synop:open-add-space'));
    } else if (action === 'lend') {
      navigation.navigate('lending');
      closeSheet(() => DeviceEventEmitter.emit('synop:open-add-lending'));
    } else if (action === 'container') {
      setPickerLoading(true);
      setSheetStep('pick-space');
      try {
        setAllSpaces(await SpaceService.getAllSpaces());
      } catch (err) {
        console.error('[FloatingTabBar] Failed to load spaces:', err);
        setSheetStep('actions');
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
      } catch (err) {
        console.error('[FloatingTabBar] Failed to load locations:', err);
        setSheetStep('actions');
      } finally {
        setPickerLoading(false);
      }
    }
  }

  function handleSpaceSelect(spaceId: string) {
    closeSheet(() => {
      router.push({ pathname: '/space/[id]' as any, params: { id: spaceId, openAddContainer: '1' } });
    });
  }

  function handleLocationSelect(spaceId: string, containerId: string | null) {
    if (containerId) {
      closeSheet(() => {
        router.push({ pathname: '/container/[id]' as any, params: { id: containerId, openAddItem: '1' } });
      });
    } else {
      closeSheet(() => {
        router.push({ pathname: '/space/[id]' as any, params: { id: spaceId, openAddItem: '1' } });
      });
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

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#2c3e50';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const borderColor = isDark ? '#3a3a3c' : '#e2e6ea';

  const stepTitle = step === 'pick-space' ? 'Select Space' : step === 'pick-location' ? 'Select Location' : 'Add New';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sheetStyles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[sheetStyles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
              {/* Handle */}
              <View style={[sheetStyles.handle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />

              {/* Header */}
              <View style={sheetStyles.header}>
                {step !== 'actions' ? (
                  <TouchableOpacity onPress={onBack} style={sheetStyles.sideBtn} activeOpacity={0.7}>
                    <FontAwesomeIcon icon={faChevronLeft} size={14} color={subtleText} />
                  </TouchableOpacity>
                ) : (
                  <View style={sheetStyles.sideBtn} />
                )}
                <Text style={[sheetStyles.title, { color: textColor }]}>{stepTitle}</Text>
                <TouchableOpacity onPress={onClose} style={sheetStyles.sideBtn} activeOpacity={0.7}>
                  <FontAwesomeIcon icon={faTimes} size={14} color={subtleText} />
                </TouchableOpacity>
              </View>

              {/* Step: main actions */}
              {step === 'actions' && ADD_ACTIONS.map(({ action, icon, label, description }, idx) => (
                <TouchableOpacity
                  key={action}
                  style={[
                    sheetStyles.actionRow,
                    idx < ADD_ACTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
                  ]}
                  onPress={() => onAction(action)}
                  activeOpacity={0.7}
                >
                  <View style={[sheetStyles.actionIcon, { backgroundColor: `${PRIMARY}15` }]}>
                    <FontAwesomeIcon icon={icon} size={18} color={PRIMARY} />
                  </View>
                  <View style={sheetStyles.actionTextBlock}>
                    <Text style={[sheetStyles.actionLabel, { color: textColor }]}>{label}</Text>
                    <Text style={[sheetStyles.actionDesc, { color: subtleText }]}>{description}</Text>
                  </View>
                  <FontAwesomeIcon icon={faChevronRight} size={12} color={subtleText} />
                </TouchableOpacity>
              ))}

              {/* Step: pick space for container */}
              {step === 'pick-space' && (
                pickerLoading ? (
                  <View style={sheetStyles.loadingBox}><ActivityIndicator size="small" color={PRIMARY} /></View>
                ) : (
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={sheetStyles.pickerScroll}>
                    {allSpaces.length === 0
                      ? <Text style={[sheetStyles.emptyText, { color: subtleText }]}>No spaces yet. Create a space first.</Text>
                      : allSpaces.map((s, idx) => (
                        <TouchableOpacity
                          key={s.id}
                          style={[
                            sheetStyles.actionRow,
                            idx < allSpaces.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
                          ]}
                          onPress={() => onSpaceSelect(s.id)}
                          activeOpacity={0.7}
                        >
                          <View style={[sheetStyles.actionIcon, { backgroundColor: `${PRIMARY}15` }]}>
                            <FontAwesomeIcon icon={faBox} size={18} color={PRIMARY} />
                          </View>
                          <View style={sheetStyles.actionTextBlock}>
                            <Text style={[sheetStyles.actionLabel, { color: textColor }]}>{s.name}</Text>
                          </View>
                          <FontAwesomeIcon icon={faChevronRight} size={12} color={subtleText} />
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
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={sheetStyles.pickerScroll}>
                    {allSpaces.length === 0
                      ? <Text style={[sheetStyles.emptyText, { color: subtleText }]}>No spaces yet. Create a space first.</Text>
                      : allSpaces.map((s) => {
                          const containers = spaceContainers[s.id] ?? [];
                          return (
                            <View key={s.id}>
                              <Text style={[sheetStyles.sectionLabel, { color: subtleText }]}>{s.name.toUpperCase()}</Text>
                              <TouchableOpacity
                                style={[sheetStyles.actionRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor }]}
                                onPress={() => onLocationSelect(s.id, null)}
                                activeOpacity={0.7}
                              >
                                <View style={[sheetStyles.actionIcon, { backgroundColor: `${PRIMARY}15` }]}>
                                  <FontAwesomeIcon icon={faMapPin} size={18} color={PRIMARY} />
                                </View>
                                <View style={sheetStyles.actionTextBlock}>
                                  <Text style={[sheetStyles.actionLabel, { color: textColor }]}>{s.name} (root)</Text>
                                </View>
                                <FontAwesomeIcon icon={faChevronRight} size={12} color={subtleText} />
                              </TouchableOpacity>
                              {containers.map((c, cidx) => (
                                <TouchableOpacity
                                  key={c.id}
                                  style={[
                                    sheetStyles.actionRow,
                                    sheetStyles.indented,
                                    cidx < containers.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
                                  ]}
                                  onPress={() => onLocationSelect(s.id, c.id)}
                                  activeOpacity={0.7}
                                >
                                  <View style={[sheetStyles.actionIcon, { backgroundColor: `${PRIMARY}15` }]}>
                                    <FontAwesomeIcon icon={faFolder} size={18} color={PRIMARY} />
                                  </View>
                                  <View style={sheetStyles.actionTextBlock}>
                                    <Text style={[sheetStyles.actionLabel, { color: textColor }]}>{c.name}</Text>
                                  </View>
                                  <FontAwesomeIcon icon={faChevronRight} size={12} color={subtleText} />
                                </TouchableOpacity>
                              ))}
                            </View>
                          );
                        })
                    }
                  </ScrollView>
                )
              )}
            </View>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sideBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextBlock: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
  indented: {
    paddingLeft: 16,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  pickerScroll: {
    maxHeight: 340,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 32,
  },
});

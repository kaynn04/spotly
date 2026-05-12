/**
 * OnboardingScreen
 *
 * Shown once on first launch. Walks the user through:
 *   1. Welcome slide
 *   2. Spaces & Containers concept
 *   3. Lending tracker concept
 *   4. Outside sessions concept
 *   5. Name input — personalises the home greeting
 *
 * On completion, sets AsyncStorage flags so it never shows again.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Dimensions,
  FlatList,
  Animated,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faFolder,
  faHandshake,
  faSuitcase,
  faUser,
  faMicrophone,
} from '@fortawesome/free-solid-svg-icons';
import { UserService } from '@/src/services/UserService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRIMARY = '#6b7f99';
const ONBOARDING_DONE_KEY = '@spotly/onboarding_done';

export async function markOnboardingDone() {
  await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
}

export async function isOnboardingDone(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
  return val === 'true';
}

interface Slide {
  key: string;
  icon?: any;
  iconColor: string;
  title: string;
  subtitle: string;
  isNameSlide?: boolean;
  source?: any;
  bullets?: string[];
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    source: require('@/assets/images/logo.png'),
    iconColor: PRIMARY,
    title: 'Welcome to Spotly',
    subtitle: 'Your personal inventory tracker. Know exactly what you own, where it is, and who has it.',
  },
  {
    key: 'spaces',
    icon: faFolder,
    iconColor: '#7b9e87',
    title: 'Spaces & Containers',
    subtitle: 'Organise your belongings into Spaces (rooms, locations) and Containers (boxes, drawers, shelves).',
  },
  {
    key: 'lending',
    icon: faHandshake,
    iconColor: '#9b7ba0',
    title: 'Track Lending',
    subtitle: 'Lend items to friends and family. Spotly remembers who has what so you never forget.',
  },
  {
    key: 'outside',
    icon: faSuitcase,
    iconColor: '#c4956a',
    title: 'Outside Sessions',
    subtitle: 'Taking items out of the house? Create a checklist session and track when everything comes back.',
  },
  {
    key: 'voice',
    icon: faMicrophone,
    iconColor: '#6b7f99',
    title: 'Voice Commands',
    subtitle: 'Tap the mic button in the nav bar to control Spotly hands-free.',
    bullets: [
      '🟢  "Add drill and hammer to Garage"',
      '🔵  "Move scissors to Kitchen"',
      '🔵  "Where is my charger?"',
      '🟣  "Lend drill to John"',
      '🟠  "Create space Tool Shed"',
    ],
  },
  {
    key: 'name',
    icon: faUser,
    iconColor: PRIMARY,
    title: "What's your name?",
    subtitle: 'Spotly will use it to greet you on the home screen.',
    isNameSlide: true,
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const listRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  // Height available for each slide (full screen minus bottom bar ~130px)
  const slideHeight = SCREEN_HEIGHT - insets.bottom - 16 - 130;

  const bg = isDark ? '#000000' : '#f8f9fa';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const inputBg = isDark ? '#2c2c2e' : '#ffffff';

  const isLastSlide = currentIndex === SLIDES.length - 1;

  function goNext() {
    if (isLastSlide) {
      handleFinish();
      return;
    }
    const next = currentIndex + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  }

  function goBack() {
    if (currentIndex === 0) return;
    const prev = currentIndex - 1;
    listRef.current?.scrollToIndex({ index: prev, animated: true });
    setCurrentIndex(prev);
  }

  async function handleFinish() {
    Keyboard.dismiss();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Please enter your name to continue');
      return;
    }
    await UserService.setName(trimmed);
    await markOnboardingDone();
    router.replace('/(tabs)');
  }

  const renderSlide = ({ item }: { item: Slide }) => (
    <KeyboardAvoidingView
      style={{ width: SCREEN_WIDTH, height: slideHeight }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.slide, { paddingTop: insets.top + 20, height: slideHeight }]}>
        {/* Icon or Logo bubble */}
        <View style={[styles.iconBubble, { backgroundColor: `${item.iconColor}18` }]}>
          {item.source ? (
            <Image source={item.source} style={{ width: 80, height: 80 }} resizeMode="contain" />
          ) : (
            <FontAwesomeIcon icon={item.icon} size={48} color={item.iconColor} />
          )}
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.subtitle, { color: subtleText }]}>{item.subtitle}</Text>

        {item.bullets && (
          <View style={styles.bulletsWrapper}>
            {item.bullets.map((b, i) => (
              <Text key={i} style={[styles.bulletText, { color: subtleText }]}>{b}</Text>
            ))}
          </View>
        )}

        {item.isNameSlide && (
          <View style={styles.nameInputWrapper}>
            <TextInput
              style={[styles.nameInput, { backgroundColor: inputBg, borderColor: nameError ? '#e53e3e' : borderColor, color: colors.text }]}
              placeholder="Your name"
              placeholderTextColor={subtleText}
              value={name}
              onChangeText={(t) => { setName(t); setNameError(null); }}
              autoFocus={false}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={handleFinish}
            />
            {nameError && (
              <Text style={[styles.errorText, { color: isDark ? '#ff453a' : '#e53e3e' }]}>{nameError}</Text>
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Slides */}
      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      />

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => {
            const opacity = scrollX.interpolate({
              inputRange: [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH],
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            const width = scrollX.interpolate({
              inputRange: [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH],
              outputRange: [6, 20, 6],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { opacity, width, backgroundColor: PRIMARY }]}
              />
            );
          })}
        </View>

        {/* Buttons row */}
        <View style={styles.btnsRow}>
          {currentIndex > 0 && (
            <TouchableOpacity style={[styles.backBtn, { borderColor }]} onPress={goBack}>
              <Text style={[styles.backBtnText, { color: subtleText }]}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.nextBtn, currentIndex === 0 && styles.nextBtnFull, { backgroundColor: PRIMARY }]}
            onPress={goNext}
          >
            <Text style={styles.nextBtnText}>
              {isLastSlide ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 20,
  },
  iconBubble: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 300,
  },
  nameInputWrapper: {
    marginTop: 28,
    width: '100%',
  },
  bulletsWrapper: {
    marginTop: 20,
    width: '100%',
    gap: 10,
  },
  bulletText: {
    fontSize: 15,
    lineHeight: 22,
  },

  nameInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: '500',
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },

  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  btnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextBtnFull: {
    flex: 1,
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

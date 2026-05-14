import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import type { WalkthroughStep, SpotlightRect } from '../models/WalkthroughStep';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PRIMARY = '#6b7f99';
const TOTAL_STEPS = 8;

interface WalkthroughOverlayProps {
  visible: boolean;
  step: WalkthroughStep | null;
  spotlightRect: SpotlightRect | null;
  currentIndex: number;
  onNext: () => void;
  onSkip: () => void;
}

export default function WalkthroughOverlay({
  visible,
  step,
  spotlightRect,
  currentIndex,
  onNext,
  onSkip,
}: WalkthroughOverlayProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  // Default spotlight to center of screen if not yet measured
  const rect: SpotlightRect = spotlightRect ?? {
    x: SCREEN_WIDTH / 2 - 40,
    y: SCREEN_HEIGHT / 2 - 40,
    width: 80,
    height: 80,
  };

  const padding = step?.spotlightPadding ?? 10;
  const sx = rect.x - padding;
  const sy = rect.y - padding;
  const sw = rect.width + padding * 2;
  const sh = rect.height + padding * 2;

  // Place tooltip above or below the spotlight
  const tooltipAbove = rect.y > SCREEN_HEIGHT * 0.55;
  const isLastStep = currentIndex === TOTAL_STEPS - 1;

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#111111';
  const subtleText = isDark ? '#8e8e93' : '#6b7280';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* SVG spotlight mask */}
        <Svg
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <Mask id="spotlight-mask" x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
              {/* White fills everything (visible) */}
              <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="white" />
              {/* Black cutout (transparent window) */}
              <Rect x={sx} y={sy} width={sw} height={sh} fill="black" rx="14" ry="14" />
            </Mask>
          </Defs>
          {/* Dark overlay with hole */}
          <Rect
            x="0"
            y="0"
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            fill="rgba(0,0,0,0.72)"
            mask="url(#spotlight-mask)"
          />
        </Svg>

        {/* Skip button — hidden on the last step */}
        {!isLastStep && (
          <Pressable style={styles.skipButton} onPress={onSkip} hitSlop={12}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}

        {/* Tooltip card */}
        <View
          style={[
            styles.tooltip,
            { backgroundColor: cardBg },
            tooltipAbove
              ? { bottom: SCREEN_HEIGHT - sy + 16 }
              : { top: sy + sh + 16 },
          ]}
        >
          {/* Step counter */}
          <Text style={[styles.stepCounter, { color: subtleText }]}>
            Step {currentIndex + 1} of {TOTAL_STEPS}
          </Text>

          {/* Dot indicators */}
          <View style={styles.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === currentIndex ? PRIMARY : (isDark ? '#3a3a3c' : '#d1d5db') },
                ]}
              />
            ))}
          </View>

          {/* Description */}
          <Text style={[styles.description, { color: textColor }]}>
            {step?.description ?? ''}
          </Text>

          {/* Action button */}
          <Pressable style={styles.nextButton} onPress={onNext}>
            <Text style={styles.nextButtonText}>
              {isLastStep ? 'Get started' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
  },
  skipText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  tooltip: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
  },
  stepCounter: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 20,
  },
  nextButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

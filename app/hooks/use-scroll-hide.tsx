/**
 * useHideOnScroll
 *
 * Shared hook that drives the tab bar's hide/show animation.
 * Each tab screen's ScrollView/FlatList passes the returned handler
 * to its `onScroll` prop.
 *
 * The animated value is shared via React context so the tab bar can
 * subscribe to it.
 */

import React, { createContext, useContext, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import { TAB_BAR_HEIGHT, TAB_BAR_OFFSET } from '@/components/ui/FloatingTabBar';

interface ScrollHideCtx {
  translateY: Animated.Value;
  handleScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => void;
}

const defaultTranslateY = new Animated.Value(0);
const defaultCtx: ScrollHideCtx = {
  translateY: defaultTranslateY,
  handleScroll: () => {},
};

const ScrollHideContext = createContext<ScrollHideCtx>(defaultCtx);

export function ScrollHideProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffsetY = useRef(0);
  const isHidden = useRef(false);

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const currentY = e.nativeEvent.contentOffset.y;
      const diff = currentY - lastOffsetY.current;
      lastOffsetY.current = currentY;

      // Only hide after scrolling past 60px (avoid top-bounce triggers)
      if (diff > 6 && currentY > 60 && !isHidden.current) {
        isHidden.current = true;
        Animated.spring(translateY, {
          toValue: TAB_BAR_HEIGHT + TAB_BAR_OFFSET + 40,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
      } else if (diff < -6 && isHidden.current) {
        isHidden.current = false;
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
      }
    },
    [translateY],
  );

  return (
    <ScrollHideContext.Provider value={{ translateY, handleScroll }}>
      {children}
    </ScrollHideContext.Provider>
  );
}

export function useScrollHide() {
  return useContext(ScrollHideContext);
}

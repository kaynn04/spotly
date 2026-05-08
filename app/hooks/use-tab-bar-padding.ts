/**
 * useTabBarPadding
 *
 * Returns the bottom padding value to apply inside contentContainerStyle
 * of ScrollView/FlatList on tab screens. This ensures the last scrollable
 * content item can be scrolled above the floating navbar pill.
 *
 * This is INSIDE the scroll content — it does NOT create a visible gap at
 * the screen bottom. The ScrollView still fills the full screen (flex: 1).
 * The padding simply makes the content "tall enough" to scroll past the
 * navbar area.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT, TAB_BAR_OFFSET } from '@/components/ui/FloatingTabBar';

export function useTabBarPadding() {
  const insets = useSafeAreaInsets();

  // pill sits at: bottom = insets.bottom + TAB_BAR_OFFSET
  // pill top edge is at: insets.bottom + TAB_BAR_OFFSET + TAB_BAR_HEIGHT from screen bottom
  // add 12px breathing room above the pill
  const tabBarPadding = insets.bottom + TAB_BAR_OFFSET + TAB_BAR_HEIGHT + 12;

  return tabBarPadding;
}

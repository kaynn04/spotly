export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WalkthroughStep {
  id: string;
  index: number;
  description: string;
  /** Key matching a ref registered in FloatingTabBar or home screen */
  targetRef: string;
  spotlightPadding?: number;
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'home-dashboard',
    index: 1,
    description: 'Welcome! This is your inventory dashboard.',
    targetRef: 'dashboard',
    spotlightPadding: 8,
  },
  {
    id: 'spaces-tab',
    index: 2,
    description: 'Spaces — organize your items by location.',
    targetRef: 'tab-spaces',
    spotlightPadding: 10,
  },
  {
    id: 'plus-button',
    index: 3,
    description: 'Quick add — rapidly add spaces, containers, and items.',
    targetRef: 'tab-mic',
    spotlightPadding: 10,
  },
  {
    id: 'lending-tab',
    index: 4,
    description: 'Lending — track items you\'ve lent out.',
    targetRef: 'tab-lending',
    spotlightPadding: 10,
  },
  {
    id: 'tools-tab',
    index: 5,
    description: 'Tools — utilities to help you manage your inventory.',
    targetRef: 'tab-outside',
    spotlightPadding: 10,
  },
  {
    id: 'voice-input',
    index: 6,
    description: 'Voice input — use speech to add items, find things, lend, and more.',
    targetRef: 'voice-input-header',
    spotlightPadding: 10,
  },
  {
    id: 'appearance-toggle',
    index: 7,
    description: 'Appearance — switch between light and dark mode.',
    targetRef: 'appearance-toggle-header',
    spotlightPadding: 8,
  },
  {
    id: 'settings-icon',
    index: 8,
    description: 'Settings — manage preferences and more.',
    targetRef: 'settings',
    spotlightPadding: 8,
  },
];

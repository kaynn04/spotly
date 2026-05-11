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
    id: 'mic-button',
    index: 3,
    description: 'Use your voice to add items, find things, lend, and more.',
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
    id: 'outside-tab',
    index: 5,
    description: 'Outside — items stored beyond your spaces.',
    targetRef: 'tab-outside',
    spotlightPadding: 10,
  },
  {
    id: 'settings-icon',
    index: 6,
    description: 'Settings — manage preferences and more.',
    targetRef: 'settings',
    spotlightPadding: 8,
  },
];

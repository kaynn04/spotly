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
    description: 'Dashboard: see what needs attention today, recent activity, and alerts in one place.',
    targetRef: 'dashboard',
    spotlightPadding: 8,
  },
  {
    id: 'spaces-tab',
    index: 2,
    description: 'Spaces: start with a room, shelf, bag, or storage area, then add containers and items inside.',
    targetRef: 'tab-spaces',
    spotlightPadding: 10,
  },
  {
    id: 'plus-button',
    index: 3,
    description: 'Quick add: use the center button when you want to add or find things without digging through screens.',
    targetRef: 'tab-mic',
    spotlightPadding: 10,
  },
  {
    id: 'scanner-button',
    index: 4,
    description: 'Scanner: scan QR labels or product barcodes from the dashboard to jump straight to the right item or location.',
    targetRef: 'dashboard-scanner',
    spotlightPadding: 10,
  },
  {
    id: 'lending-tab',
    index: 5,
    description: 'Lending: choose an item, set the quantity, and Synop restores it when it comes back.',
    targetRef: 'tab-lending',
    spotlightPadding: 10,
  },
  {
    id: 'tools-tab',
    index: 6,
    description: 'Tools: generate QR labels, scan barcodes, track warranties, and manage outside sessions.',
    targetRef: 'tab-tools',
    spotlightPadding: 10,
  },
  {
    id: 'voice-input',
    index: 7,
    description: 'Voice: say what you want to add, move, find, lend, or return when typing feels slow.',
    targetRef: 'voice-input-header',
    spotlightPadding: 10,
  },
  {
    id: 'appearance-toggle',
    index: 8,
    description: 'Appearance: switch light or dark mode anytime.',
    targetRef: 'appearance-toggle-header',
    spotlightPadding: 8,
  },
  {
    id: 'settings-icon',
    index: 9,
    description: 'Settings: backups, starter templates, guide, and account controls live here.',
    targetRef: 'settings',
    spotlightPadding: 8,
  },
];

export const SPACES_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'spaces-search',
    index: 1,
    description: 'Search finds spaces, containers, and items quickly once your inventory grows.',
    targetRef: 'spaces-search',
    spotlightPadding: 8,
  },
  {
    id: 'spaces-card',
    index: 2,
    description: 'Tap a space card to open it and manage the containers and items that belong there.',
    targetRef: 'spaces-first-card',
    spotlightPadding: 8,
  },
  {
    id: 'spaces-view',
    index: 3,
    description: 'Switch list or grid view depending on how you prefer to scan your spaces.',
    targetRef: 'spaces-view-toggle',
    spotlightPadding: 8,
  },
  {
    id: 'spaces-sort-filter',
    index: 4,
    description: 'Sort and filter keep busy inventories easier to browse.',
    targetRef: 'spaces-sort-filter',
    spotlightPadding: 8,
  },
  {
    id: 'spaces-long-press',
    index: 5,
    description: 'Long press a space to select it and reveal edit or delete actions.',
    targetRef: 'spaces-first-card',
    spotlightPadding: 8,
  },
];

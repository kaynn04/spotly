import React, { createContext, useContext } from 'react';
import type { TabBarHandle } from '@/components/ui/FloatingTabBar';

interface WalkthroughContextValue {
  tabBarRef: React.RefObject<TabBarHandle | null>;
}

const WalkthroughContext = createContext<WalkthroughContextValue>({
  tabBarRef: { current: null },
});

export function WalkthroughProvider({
  children,
  tabBarRef,
}: {
  children: React.ReactNode;
  tabBarRef: React.RefObject<TabBarHandle | null>;
}) {
  return (
    <WalkthroughContext.Provider value={{ tabBarRef }}>
      {children}
    </WalkthroughContext.Provider>
  );
}

export function useWalkthroughContext() {
  return useContext(WalkthroughContext);
}

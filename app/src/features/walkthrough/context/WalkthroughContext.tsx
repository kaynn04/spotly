import React, { createContext, useContext, useState, useCallback } from 'react';
import type { TabBarHandle } from '@/components/ui/FloatingTabBar';
import type { SpotlightRect } from '../models/WalkthroughStep';

interface WalkthroughContextValue {
  tabBarRef: React.RefObject<TabBarHandle | null>;
  screenRefs: Map<string, React.RefObject<any>>;
  registerScreenRef: (id: string, ref: React.RefObject<any>) => void;
  measureScreenRef: (id: string) => Promise<SpotlightRect | null>;
}

const WalkthroughContext = createContext<WalkthroughContextValue>({
  tabBarRef: { current: null },
  screenRefs: new Map(),
  registerScreenRef: () => {},
  measureScreenRef: async () => null,
});

export function WalkthroughProvider({
  children,
  tabBarRef,
}: {
  children: React.ReactNode;
  tabBarRef: React.RefObject<TabBarHandle | null>;
}) {
  const [screenRefs] = useState<Map<string, React.RefObject<any>>>(new Map());

  const registerScreenRef = useCallback((id: string, ref: React.RefObject<any>) => {
    screenRefs.set(id, ref);
  }, [screenRefs]);

  const measureScreenRef = useCallback(
    async (id: string): Promise<SpotlightRect | null> => {
      const ref = screenRefs.get(id);
      if (!ref?.current) return null;
      
      return new Promise<SpotlightRect>((resolve, reject) => {
        ref.current?.measure((_, __, width, height, pageX, pageY) => {
          resolve({ x: pageX, y: pageY, width, height });
        }) ?? reject(new Error(`ref ${id} not found`));
      }).catch(() => null);
    },
    [screenRefs]
  );

  return (
    <WalkthroughContext.Provider
      value={{
        tabBarRef,
        screenRefs,
        registerScreenRef,
        measureScreenRef,
      }}
    >
      {children}
    </WalkthroughContext.Provider>
  );
}

export function useWalkthroughContext() {
  return useContext(WalkthroughContext);
}

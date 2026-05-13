# Data Model: In-App Guided Walkthrough

## Entities

### WalkthroughStep

A single step in the walkthrough sequence.

```typescript
// app/src/features/walkthrough/models/WalkthroughStep.ts

export interface SpotlightRect {
  x: number;       // pageX from measure() — absolute screen X
  y: number;       // pageY from measure() — absolute screen Y
  width: number;
  height: number;
}

export interface WalkthroughStep {
  /** Unique identifier for this step, also used as ref key */
  id: string;
  /** 1-based display index */
  index: number;
  /** Short description shown in the tooltip callout */
  description: string;
  /** Which UI element to spotlight — matched to a ref registered in WalkthroughRefsContext */
  targetRef: string;
  /** Corner radius of the spotlight rectangle (default: 12) */
  spotlightRadius?: number;
  /** Padding around the measured element (default: 8) */
  spotlightPadding?: number;
}
```

**Static definition** (no DB, no service mutation needed):

| id | index | targetRef | description |
|----|-------|-----------|-------------|
| `home-dashboard` | 1 | `dashboard` | "Welcome! This is your inventory dashboard." |
| `spaces-tab` | 2 | `tab-spaces` | "Spaces — organize your items by location." |
| `mic-button` | 3 | `tab-mic` | "Tap the mic to add items by voice." |
| `lending-tab` | 4 | `tab-lending` | "Lending — track items you've lent out." |
| `outside-tab` | 5 | `tab-outside` | "Outside — items stored beyond your spaces." |
| `settings-icon` | 6 | `settings` | "Settings — manage preferences and more." |

---

### WalkthroughState

**Persisted**: AsyncStorage key `@synop/walkthrough_done`

```typescript
// Value: 'true' | null (absent = not done)
// No complex object needed — single boolean flag
```

**Operations** (WalkthroughService):

```typescript
export class WalkthroughService {
  static readonly STORAGE_KEY = '@synop/walkthrough_done';

  static async isDone(): Promise<boolean>
  static async markDone(): Promise<void>
  static async reset(): Promise<void>   // for Settings replay
}
```

---

### WalkthroughRefsContext

A React context that holds refs to measurable UI elements. Populated by individual screens/components; consumed by `WalkthroughOverlay`.

```typescript
// app/src/features/walkthrough/context/WalkthroughRefsContext.tsx

export interface WalkthroughRefs {
  refs: Map<string, React.RefObject<View>>;
  registerRef: (key: string, ref: React.RefObject<View>) => void;
}
```

**Ref keys** (matching `WalkthroughStep.targetRef`):

| Key | Registered by | Element |
|-----|--------------|---------|
| `dashboard` | `app/(tabs)/index.tsx` | Home header/stats area |
| `tab-spaces` | `FloatingTabBar.tsx` | Spaces tab Pressable |
| `tab-mic` | `FloatingTabBar.tsx` | Center mic button |
| `tab-lending` | `FloatingTabBar.tsx` | Lending tab Pressable |
| `tab-outside` | `FloatingTabBar.tsx` | Outside tab Pressable |
| `settings` | `app/(tabs)/index.tsx` | Settings gear icon |

---

## State Transitions

```
[App launch]
    │
    ▼
WalkthroughService.isDone() ──false──▶ useFocusEffect (home tab)
    │                                        │
   true                                 500ms delay
    │                                        │
    ▼                                        ▼
[No overlay]                    WalkthroughOverlay visible=true
                                     step index = 0
                                         │
                                    [measure targetRef]
                                         │
                                    [render spotlight + tooltip]
                                         │
                                  ┌──────┴──────┐
                                 Next          Skip
                                  │              │
                              step < 5       markDone()
                                  │              │
                             next step       [overlay hidden]
                                  │
                               step = 5
                                  │
                                Done
                                  │
                              markDone()
                                  │
                            [overlay hidden]
```

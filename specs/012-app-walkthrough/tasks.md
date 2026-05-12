# Tasks: In-App Guided Walkthrough

**Input**: `specs/012-app-walkthrough/` — spec.md, plan.md, research.md, data-model.md
**Branch**: `033-introduction`
**No tests** — manual on-device verification only

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the 3 new files and install nothing (react-native-svg is already in Expo).

- [X] T001 Create `app/src/features/walkthrough/models/WalkthroughStep.ts` with `SpotlightRect` and `WalkthroughStep` interfaces and the 6-step `WALKTHROUGH_STEPS` constant array (descriptions from FR-004)
- [X] T002 Create `app/src/features/walkthrough/services/WalkthroughService.ts` with `isDone()`, `markDone()`, and `reset()` using AsyncStorage key `@spotly/walkthrough_done`

**Checkpoint**: Types and persistence ready — overlay and integration can proceed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add ref registration to `FloatingTabBar` so tab positions can be measured. Must be done before the overlay can spotlight tab items.

- [X] T003 In `app/components/ui/FloatingTabBar.tsx`, store a `tabRefs` array with one `ref` per tab Pressable (including the mic button) and expose a `measureTab(key: string): Promise<SpotlightRect>` function via `useImperativeHandle` + `forwardRef`
- [X] T004 In `app/app/(tabs)/_layout.tsx`, create a `walkthroughTabBarRef` using `useRef<TabBarHandle>` and pass it to `<FloatingTabBar>` via the `tabBar` render prop

**Checkpoint**: Tab positions are now measurable from the home screen — overlay implementation can begin.

---

## Phase 3: User Story 1 — Automatic First-Launch Walkthrough (Priority: P1) 🎯 MVP

**Goal**: Show the 6-step spotlight walkthrough automatically on first home screen visit after onboarding.

**Independent Test**: Clear app data (or call `WalkthroughService.reset()` from console), launch app, complete onboarding → walkthrough overlay must appear within 1 second, cycle through all 6 steps with Next, complete with Done, and not reappear on next launch.

- [X] T005 [US1] Create `app/src/features/walkthrough/components/WalkthroughOverlay.tsx` — a `<Modal transparent>` component that:
  - Accepts `props: { visible, steps, currentStep, spotlightRect, onNext, onSkip }`
  - Renders a full-screen dark overlay using `react-native-svg` `<Svg><Defs><Mask>` with a white full-screen `<Rect>` and a black `<Rect rx={12}>` cutout at `spotlightRect` coordinates
  - Renders a tooltip `<View>` card (white background, rounded, shadow) above or below the spotlight based on whether `spotlightRect.y > screenHeight / 2`
  - Tooltip contains: step counter ("1 of 6"), description text, Skip (top-right) and Next/Done buttons
  - Fade-in animation using `Animated.Value` on `visible` change

- [X] T006 [P] [US1] In `app/app/(tabs)/index.tsx` (home screen):
  - Add a `dashboardRef = useRef<View>()` on the stats/header area and a `settingsRef = useRef<View>()` on the settings gear icon
  - Add `useFocusEffect` that checks `WalkthroughService.isDone()` and, if false, waits 500ms then starts the walkthrough
  - Add `walkthroughVisible` and `walkthroughStep` state (0-based index)
  - Add `measureCurrentStep(stepIndex)` function that calls `ref.current.measure()` or `tabBarRef.current?.measureTab(key)` based on the step's `targetRef` key and returns a `SpotlightRect`
  - Render `<WalkthroughOverlay>` with wired `onNext` (advance step, measure next target) and `onSkip` (call `markDone`, hide overlay) handlers

---

## Phase 4: User Story 2 — Skip at Any Point (Priority: P2)

**Goal**: Skip button on every step immediately dismisses the walkthrough and persists completion.

**Independent Test**: Trigger walkthrough, tap Skip on step 3 → overlay disappears, re-launch app → walkthrough does not reappear.

- [X] T007 [US2] In `WalkthroughOverlay.tsx`, ensure "Skip" `<TouchableOpacity>` is rendered on every step (not just non-final steps) and calls `onSkip` prop
- [X] T008 [US2] In `index.tsx` `onSkip` handler, call `await WalkthroughService.markDone()` then set `walkthroughVisible(false)` — verify this is the same handler used for "Done" (they share identical logic)

*Note: US2 is largely already covered by US1 implementation — T007/T008 are verification/polish tasks.*

---

## Phase 5: User Story 3 — Restart from Settings (Priority: P3)

**Goal**: "Restart Walkthrough" option in Settings clears the flag and triggers the walkthrough from step 1.

**Independent Test**: Open Settings → tap "Restart Walkthrough" → overlay appears from step 1 → complete it → return to Settings → option still visible.

- [X] T009 [US3] In `app/app/settings.tsx`, add a "Restart Walkthrough" row (same style as existing settings rows) that calls `WalkthroughService.reset()` then `router.replace('/(tabs)')` to return home where `useFocusEffect` will re-trigger the walkthrough

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T010 [P] In `WalkthroughOverlay.tsx`, add a guard: if `spotlightRect` is null/undefined for the current step (element not yet measured), show a loading spinner instead of the SVG cutout, and retry measurement after 200ms
- [X] T011 [P] Verify dark mode: tooltip card uses theme-aware colors (`isDark ? '#1c1c1e' : '#ffffff'` background, appropriate text colors matching app's `Colors` theme constants)

---

## Dependencies

```
T001 → T005, T006
T002 → T006, T008, T009
T003 → T004 → T006
T005 → T006
T006 → T007, T008 (review/verify)
T009 (independent, needs T002)
T010, T011 → depend on T005
```

## Parallel Execution

- **T001, T002** can be written simultaneously (different files, no dependencies)
- **T003, (later) T005** can be written simultaneously once T001 is done
- **T010, T011** polish tasks can be done together at the end

## MVP Scope

**US1 only** (T001 → T006) delivers the complete first-launch walkthrough end-to-end. US2 and US3 are additive and can be deferred.

## Implementation Strategy

1. Write types + service (T001, T002) — pure TypeScript, no UI
2. Add forwardRef to FloatingTabBar + wire in layout (T003, T004) — structural change
3. Build WalkthroughOverlay component (T005) — isolated, testable by passing mock props
4. Wire overlay into home screen (T006) — integration point
5. Verify skip behavior (T007, T008) — mostly covered by T005/T006
6. Add Settings option (T009) — one row + two function calls
7. Polish (T010, T011)

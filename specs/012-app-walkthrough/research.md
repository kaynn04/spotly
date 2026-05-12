# Research: In-App Guided Walkthrough

## Decision 1: Spotlight Cutout Technique

**Decision**: SVG-based cutout using `react-native-svg` (already a transitive Expo dependency)

**Rationale**: A true transparent "hole" through which the underlying UI is visible. The View-based border approach (an overlay with a highlighted border around the target) is simpler but looks like a box selector, not a spotlight. SVG Mask gives a proper dimmed-background-with-hole effect at minimal extra cost since `react-native-svg` is already present in the project.

**Alternatives considered**:
- Pure View layering: simpler but no true hole — just a bright border over a dark overlay. Rejected for visual quality.
- External library (e.g., `react-native-copilot`, `rn-tourguide`): fast to build but violates FR-009 (no third-party walkthrough libs).

**Implementation**: `<Svg>` with a `<Defs><Mask>` containing a white full-screen `<Rect>` and a black `<Rect rx>` for the hole, applied to a dark `<Rect fill="rgba(0,0,0,0.7)">`.

---

## Decision 2: Target Element Measurement

**Decision**: `ref.current.measure(callback)` called 100ms after `onLayout` fires

**Rationale**: `measure()` gives `pageX/pageY` — absolute coordinates relative to the root window — which is exactly what the SVG overlay needs for positioning. The 100ms delay after `onLayout` ensures animations (FloatingTabBar spring-in) have settled.

**Key points**:
- Use `pageX`/`pageY` (not `x`/`y` which are parent-relative)
- Must call after layout completes; `onLayout` + `setTimeout(100)` is reliable on Android
- For the FloatingTabBar tabs, use `useImperativeHandle` + `forwardRef` to expose `measureTab(index)` to the layout

---

## Decision 3: Ref Architecture

**Decision**: Pass a single `walkthroughRefs` context object from `_layout.tsx` down to both `FloatingTabBar` and `index.tsx` (home screen)

**Rationale**: The walkthrough overlay needs measurements from multiple components: the home screen header area, and the FloatingTabBar tab buttons. A React context (`WalkthroughRefsContext`) avoids prop-drilling through Expo Router's layout system.

**Alternative considered**: Forwarding refs through Expo Router `<Tabs>` — not straightforward since the tabBar prop is a render function, not a component instance.

---

## Decision 4: Tooltip Positioning

**Decision**: Tooltip renders above the spotlight when the target is in the bottom half of the screen, below when in the top half.

**Rationale**: Tab bar targets are at the bottom — tooltip must go above. Dashboard header is near top — tooltip goes below. Threshold: `pageY > screenHeight / 2` → render above.

**Arrow indicator**: A small triangle `<View>` using `borderWidth` trick (transparent sides, colored top/bottom) pointing toward the spotlight.

---

## Decision 5: Walkthrough Trigger Location

**Decision**: Trigger from `app/(tabs)/index.tsx` (home screen) using `useFocusEffect`

**Rationale**: The walkthrough targets elements on the home screen (dashboard) and the FloatingTabBar. Both are rendered when the home tab is focused. Using `useFocusEffect` ensures the screen and tab bar are fully mounted before measurement.

**Flow**:
1. `useFocusEffect` → check `WalkthroughService.isDone()`
2. If not done → 500ms delay → start walkthrough (allows tab bar spring animation to settle)
3. WalkthroughOverlay renders as a Modal on top of everything

---

## Resolved Unknowns from Spec

| Was NEEDS CLARIFICATION | Resolution |
|------------------------|------------|
| Cutout technique | SVG Mask via react-native-svg |
| How to measure tab buttons | forwardRef + useImperativeHandle on FloatingTabBar |
| Tooltip direction logic | Above if target in bottom half, below if top half |
| Trigger timing | useFocusEffect + 500ms delay for animation settle |
| Ref passing to FloatingTabBar | WalkthroughRefsContext |

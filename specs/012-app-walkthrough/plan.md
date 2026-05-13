# Implementation Plan: In-App Guided Walkthrough

**Branch**: `033-introduction` | **Date**: 2026-05-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-app-walkthrough/spec.md`

## Summary

A first-launch guided walkthrough that spotlights 6 UI elements (home dashboard, Spaces tab, mic button, Lending tab, Outside tab, Settings gear) using a full-screen dark overlay with a transparent "cutout" hole over each target. Navigation is step-by-step via Next/Done/Skip. Completion is persisted to AsyncStorage. Walkthrough can be replayed from Settings.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: React Native core (Modal, Animated, View, measure()), AsyncStorage, expo-router, react-native-safe-area-context
**Storage**: AsyncStorage key `@synop/walkthrough_done` (boolean flag)
**Testing**: Manual on-device (Android primary)
**Target Platform**: Android (primary), iOS (best-effort)
**Project Type**: Mobile app (React Native + Expo managed workflow)
**Performance Goals**: Overlay appears within 1 second of home screen render; 60 fps transitions
**Constraints**: No third-party walkthrough libraries; React Native core primitives only; offline-capable
**Scale/Scope**: 6 steps, single screen (home), minimal state

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Spec exists and is approved | ✅ PASS | spec.md complete with clarifications |
| No third-party libraries for walkthrough | ✅ PASS | Using React Native Modal + Animated only |
| Single responsibility per component | ✅ PASS | WalkthroughOverlay is self-contained |
| Local-first persistence | ✅ PASS | AsyncStorage, no cloud sync |
| No ORMs / direct SQL | ✅ N/A | No database layer needed (AsyncStorage only) |
| Functions under 30 lines | ✅ PASS | Step logic is simple, no complex branching |
| UI calls service only | ✅ PASS | WalkthroughService wraps AsyncStorage |

## Project Structure

### Documentation (this feature)

```text
specs/012-app-walkthrough/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code

```text
app/src/features/walkthrough/
├── models/
│   └── WalkthroughStep.ts        ← Step type definition
├── services/
│   └── WalkthroughService.ts     ← AsyncStorage persistence (isDone / markDone / reset)
└── components/
    └── WalkthroughOverlay.tsx    ← Full overlay, spotlight hole, tooltip, Next/Skip buttons

app/app/(tabs)/index.tsx           ← Add ref forwarding + walkthrough trigger (after onboarding)
app/app/settings.tsx               ← Add "Restart Walkthrough" option
app/components/ui/FloatingTabBar.tsx ← Add forwardRef / expose measure refs for tab targets
```

## Complexity Tracking

No constitution violations.


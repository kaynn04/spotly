# Feature Specification: In-App Guided Walkthrough

**Feature Branch**: `012-app-walkthrough`
**Created**: 2026-05-11
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic First-Launch Walkthrough (Priority: P1)

A new user who has just completed onboarding lands on the home screen and is automatically guided through the six key areas of the app via a spotlight overlay sequence, one element at a time.

**Why this priority**: First-time user orientation is the core value of this feature. Without it, new users may miss key navigation elements (mic button, Outside tab, etc.) and churn early.

**Independent Test**: Can be fully tested by clearing app data (resetting walkthrough state) and launching to the home screen — the walkthrough must appear automatically and guide through all 6 steps.

**Acceptance Scenarios**:

1. **Given** the user has completed onboarding and has never seen the walkthrough, **When** the home screen renders, **Then** the walkthrough overlay appears within 1 second, starting at Step 1 (Home dashboard).
2. **Given** the walkthrough is active on Step 1, **When** the user taps "Next", **Then** the overlay transitions to Step 2, highlighting the Spaces tab.
3. **Given** the walkthrough is active on the final step (Step 6), **When** the user taps "Done", **Then** the overlay is dismissed, completion is persisted, and the user is on the home screen.
4. **Given** the user has previously completed the walkthrough, **When** they relaunch the app, **Then** the walkthrough does NOT appear.

---

### User Story 2 - Skip Walkthrough at Any Point (Priority: P2)

A user who does not want guidance can dismiss the entire walkthrough at any step by tapping a "Skip" button. The walkthrough is marked complete so it will not re-appear.

**Why this priority**: Forcing the walkthrough on experienced or impatient users creates friction. Skip must always be available.

**Independent Test**: Can be tested independently by triggering the walkthrough on any step, tapping Skip, and verifying the overlay disappears and is not shown again.

**Acceptance Scenarios**:

1. **Given** the walkthrough is active on any step, **When** the user taps "Skip", **Then** the overlay is immediately dismissed.
2. **Given** the user has skipped the walkthrough, **When** they relaunch the app, **Then** the walkthrough does NOT appear again (skip is treated as completion).

---

### User Story 3 - Re-trigger Walkthrough from Settings (Priority: P3)

An existing user who wants to revisit the walkthrough opens the Settings screen, taps "Restart Walkthrough", and the full walkthrough plays from Step 1.

**Why this priority**: Discoverability of advanced features improves over time. Users who skipped initially should be able to opt back in from a known location.

**Independent Test**: Can be tested independently by tapping "Restart Walkthrough" in Settings and verifying the overlay sequence starts from Step 1.

**Acceptance Scenarios**:

1. **Given** the user opens Settings, **When** they tap "Restart Walkthrough", **Then** the walkthrough overlay appears starting at Step 1.
2. **Given** the user triggers the walkthrough from Settings and completes it, **When** they return to Settings, **Then** the "Restart Walkthrough" option is still visible and functional.
3. **Given** the user triggers the walkthrough from Settings and taps Skip, **When** they return to Settings, **Then** the option remains available for future use.

---

### Edge Cases

- What happens if a target UI element has not yet rendered when its step is displayed (e.g., the tab bar is still animating in)?
- What happens if the user force-closes the app mid-walkthrough — does the walkthrough resume or restart on next launch?
- What happens if the device screen size causes a highlighted element to be partially off-screen?
- How does the overlay behave when the device is in dark mode?

## Clarifications *(answered 2026-05-11)*

| # | Question | Answer |
|---|----------|--------|
| 1 | What tooltip text should each step show? | Use suggested defaults (see FR-004 below) |
| 2 | When should the walkthrough trigger? | Only on first launch, after onboarding is completed |
| 3 | What happens if the user skips mid-way? | Mark as done — never show again |
| 4 | What overlay style? | Dark semi-transparent backdrop + highlighted (non-dimmed) element |
| 5 | Replay from Settings? | Yes — "Restart Walkthrough" option in Settings |

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The walkthrough MUST trigger automatically on the home screen the first time a user completes onboarding, before any other interaction.
- **FR-002**: The walkthrough MUST present exactly 6 steps in a fixed order, each targeting a specific named UI element:
  1. Home screen dashboard area
  2. Spaces tab in the bottom tab bar
  3. Mic button (center) in the bottom tab bar
  4. Lending tab in the bottom tab bar
  5. Outside tab in the bottom tab bar
  6. Settings gear icon on the home screen
- **FR-003**: Each step MUST display a dimmed full-screen overlay with a visible, non-dimmed spotlight region around the target UI element.
- **FR-004**: Each step MUST display a tooltip/callout with the following step-specific description text and a visual indicator (arrow or pointer) directed at the highlighted element:
  1. *"Welcome! This is your inventory dashboard."*
  2. *"Spaces — organize your items by location."*
  3. *"Tap the mic to add items by voice."*
  4. *"Lending — track items you've lent out."*
  5. *"Outside — items stored beyond your spaces."*
  6. *"Settings — manage preferences and more."*
- **FR-005**: Each step MUST include a "Next" button to advance to the following step, except the final step which MUST show "Done".
- **FR-006**: Every step MUST include a "Skip" button that immediately dismisses the entire walkthrough.
- **FR-007**: Dismissing (via "Done" or "Skip") MUST persist walkthrough completion to AsyncStorage under the key `@spotly/walkthrough_done`.
- **FR-008**: The Settings screen MUST include a "Restart Walkthrough" option that clears the persisted completion state and initiates the walkthrough from Step 1.
- **FR-009**: The walkthrough MUST NOT use any third-party walkthrough or tooltip libraries; it MUST be implemented using React Native core primitives (Modal, Animated, View).
- **FR-010**: Spotlight positioning MUST be derived by measuring the target element's on-screen coordinates using React Native's `measure()` API on element refs.
- **FR-011**: The walkthrough MUST function correctly on Android (primary platform); iOS support is a best-effort bonus.

### Key Entities

- **WalkthroughStep**: A single step in the sequence — contains the step index, description text, and a reference key identifying which UI element to highlight.
- **WalkthroughState**: The persisted record (AsyncStorage) indicating whether the user has completed or skipped the walkthrough. Value is a boolean flag stored at `@spotly/walkthrough_done`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The walkthrough overlay appears within 1 second of the home screen becoming visible after onboarding completion.
- **SC-002**: Each spotlight accurately frames its target UI element on Android across at least two different screen sizes (compact phone, standard phone).
- **SC-003**: A user can complete all 6 steps from start to "Done" in under 60 seconds.
- **SC-004**: After walkthrough completion (or skip), the walkthrough does not re-appear on any subsequent app launch, verified across cold starts.
- **SC-005**: The "Restart Walkthrough" option in Settings successfully re-initiates the walkthrough in 1 tap.
- **SC-006**: The walkthrough overlay does not obstruct or permanently alter the underlying screen — all UI elements function normally after dismissal.

## Assumptions

- The walkthrough is triggered only on the home screen (not during an in-progress onboarding flow); onboarding and walkthrough are sequential.
- A force-close mid-walkthrough results in the walkthrough restarting from Step 1 on the next launch (completion is only persisted on Done/Skip).
- Element refs for the tab bar items and settings icon are accessible from the screen level via a shared context or prop-drilling; exact implementation approach is left to the plan phase.
- All six step descriptions are fixed English strings; no localization is required for this release.
- The Settings gear icon referenced in Step 6 is the existing icon visible on the home screen header.
- Dark mode is supported by the overlay (it remains functional), but visual tuning for dark mode is out of scope for this spec.
- AsyncStorage is already a project dependency (used for other preferences).

## Out of Scope

- Web (browser) support
- Animated mascot or character
- Video tutorials or screen recordings
- Per-step deep linking or navigation (the walkthrough overlays the current screen; it does not navigate)
- Walkthrough analytics or completion-rate tracking
- Localization / multi-language support
- iOS-specific spotlight blur effects

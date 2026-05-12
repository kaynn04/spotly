# Feature Specification: Voice Input for Item Creation

**Feature Branch**: `011-voice-input`  
**Created**: May 11, 2026  
**Status**: Draft  
**Input**: User description: "Full natural language voice input — user can say things like 'Add drill to garage shelf' and the app parses the space, container, and item name from speech, then adds the item automatically."

## Overview

The Voice Input feature lets users add items to their inventory by speaking naturally instead of navigating the app's hierarchy manually. A microphone button on the dashboard activates a listening session. The user speaks a command like "Add drill to garage shelf," the app extracts the item name, space, and container from the speech, shows a parsed result for review, and — after the user confirms — creates the item in the correct location.

The feature is entirely on-device: no audio leaves the phone, no internet connection is required, and no external speech API is called.

## User Goals

- **Add items quickly**: Capture newly found or purchased items without tapping through menus
- **Speak naturally**: Not be required to memorize a rigid command format
- **Stay in control**: See exactly what the app understood before anything is saved
- **Recover from mistakes**: Retry or cancel if the result isn't right

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Item to a Known Location (Priority: P1)

A user wants to record a new item they just placed in their garage shelf. They tap the microphone button on the dashboard, say "Add drill to garage shelf," and the app shows a confirmation card: item "Drill", space "Garage", container "Shelf". They tap Add and the item is saved.

**Why this priority**: This is the entire point of the feature. It delivers immediate value on its own — a user can add an item in under 15 seconds without touching any other screen.

**Independent Test**: Can be fully tested by speaking a complete command (item + space + container) that exactly matches existing inventory, verifying the confirmation card, and confirming that the item appears in the correct location afterward.

**Acceptance Scenarios**:

1. **Given** the user is on the dashboard, **When** they tap the microphone button, **Then** the app enters listening mode with a clear animated visual indicator
2. **Given** the app is in listening mode, **When** the user says "Add drill to garage shelf", **Then** listening stops and the app displays a parsed result card showing: item "Drill", space "Garage", container "Shelf"
3. **Given** the parsed result is shown, **When** the user taps "Add", **Then** the item is created in the matched location and a success message is displayed
4. **Given** the parsed result is shown, **When** the user taps "Cancel", **Then** no item is created and the app returns to the dashboard
5. **Given** the item was successfully created, **When** the user navigates to the matched container, **Then** the new item appears in the item list

---

### User Story 2 - Ambiguity: Space or Container Name Not Found (Priority: P2)

A user speaks a location name that doesn't exactly match anything in their inventory — either due to a slight mispronunciation, background noise, or a name that simply doesn't exist. The app shows what it heard, offers close matches if any exist, and allows the user to correct the result before confirming.

**Why this priority**: Voice recognition is imperfect and user inventory names vary. Without graceful ambiguity handling, users lose trust in the feature after the first failure. Required for real-world reliability.

**Independent Test**: Can be tested independently by speaking a space name with a slight mispronunciation (e.g., "garaj" for "Garage") and verifying the app offers a suggestion rather than silently failing or creating a wrong entry.

**Acceptance Scenarios**:

1. **Given** the user says "Add hammer to werkshop drawer" and "Workshop" exists in their inventory but "Werkshop" does not, **When** parsing completes, **Then** the app shows the parsed card with "Did you mean: Workshop?" highlighted on the space field
2. **Given** a close match is offered, **When** the user taps the suggestion, **Then** the space field updates to the matched name and the user can proceed to confirm
3. **Given** the user says a space name with no close match in their inventory, **When** parsing completes, **Then** the app clearly shows the space field as unresolved and displays a message such as "Space '[spoken name]' not found"
4. **Given** an unresolved space is shown, **When** the user taps the space field, **Then** a picker opens listing all their existing spaces for manual selection
5. **Given** the space is matched but the container name is not found within that space, **When** parsing completes, **Then** the space shows as matched and the container field shows as unresolved with the same correction flow
6. **Given** the user manually selects both space and container, **When** they confirm, **Then** the item is created in the manually chosen location

---

### User Story 3 - Partial Command: No Container Mentioned (Priority: P2)

A user says "Add scissors to office" without naming a specific container. The app correctly parses the item and space, recognizes the container is absent, and prompts the user to choose one before confirming.

**Why this priority**: Natural speech frequently omits one level of the hierarchy. Forcing users to speak in a rigid format degrades the experience. This story handles the common partial-input case gracefully.

**Independent Test**: Can be tested independently by saying "[item] to [space]" with no container, verifying a container picker appears, selecting one, confirming, and verifying the item is created correctly.

**Acceptance Scenarios**:

1. **Given** the user says "Add scissors to office" and "Office" exists with containers, **When** parsing completes, **Then** the parsed result card shows the item and space correctly and the container field shows "Select a container" as a required step
2. **Given** the container field is empty and the space has containers, **When** the user taps the container field, **Then** a picker opens listing all containers in the matched space
3. **Given** the user selects a container from the picker, **When** they tap "Add", **Then** the item is created in the selected container
4. **Given** the matched space has no containers, **When** parsing completes, **Then** the container field is hidden and the user can confirm to add the item directly to the space

---

### User Story 4 - Retry and Cancel (Priority: P3)

A user speaks but the result is wrong — background noise, a misheard word, or a completely failed capture. The app shows the failure clearly and lets the user try again or walk away, with no side effects.

**Why this priority**: Trust requires a reliable escape hatch. Users must never feel trapped or afraid that a bad voice capture will corrupt their inventory.

**Independent Test**: Can be tested independently by speaking unclearly or tapping "Try Again" from the result card, verifying the app restarts listening and that no item is created until explicit confirmation.

**Acceptance Scenarios**:

1. **Given** the parsed result is displayed, **When** the user taps "Try Again", **Then** the app discards the current result and re-enters listening mode
2. **Given** the app completely fails to extract any meaningful content from the speech, **When** listening ends, **Then** the app shows a clear error ("Didn't catch that — try again") with options to retry or cancel
3. **Given** the user taps "Cancel" at any point during the voice session, **Then** no item is created, no data is modified, and the app returns to its previous state
4. **Given** listening times out due to prolonged silence, **Then** the app behaves identically to a failed capture: shows an error and offers retry or cancel

---

### Edge Cases

- What if the user speaks only an item name with no location? → App shows the item as parsed but both space and container fields are unresolved; user must manually select a space before confirming
- What if microphone permission is denied? → App shows a one-time permission prompt explaining why the mic is needed; if denied, the feature is unavailable and the mic button shows a disabled state with a brief explanation
- What if the device has no microphone? → The microphone button is not shown; the feature is silently absent rather than showing an error
- What if multiple spaces have names that sound similar (e.g., "Garage" and "Garage 2")? → All matching candidates are listed for the user to choose; no automatic selection is made when ambiguity exists
- What if the spoken item name is very short or generic (e.g., "thing", "it")? → The name is accepted as-is; item naming is not validated beyond being non-empty
- What if the user's inventory is empty (no spaces yet)? → Parsing shows the item name but all location fields are unresolved; user is prompted to navigate to inventory setup before using voice input

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a microphone activation FAB (floating action button) in the bottom-right corner of the dashboard screen
- **FR-002**: The system MUST clearly indicate when it is actively listening, including a visual animation that distinguishes the listening state from idle
- **FR-003**: The system MUST accept spoken input and attempt to extract an item name, space name, and container name from natural language speech
- **FR-004**: The system MUST display the parsed result — item name, space, and container — to the user before creating any data
- **FR-005**: The system MUST allow the user to confirm or cancel the parsed result before any item is created
- **FR-006**: The system MUST match spoken space and container names against the user's existing inventory using case-insensitive and approximate (fuzzy) comparison
- **FR-007**: The system MUST present close-match suggestions when a spoken space or container name is not an exact match to any existing record
- **FR-008**: The system MUST allow the user to manually select a space or container from a picker when the spoken name cannot be resolved
- **FR-009**: The system MUST handle the case where no container is mentioned by showing a container picker when the matched space contains containers
- **FR-010**: The system MUST allow the user to retry voice input from the result screen without returning to the dashboard
- **FR-011**: The system MUST handle a failed or empty voice capture gracefully, showing an error message and offering retry or cancel
- **FR-012**: The system MUST handle listening timeout (10 seconds of silence) identically to a failed capture — show error and offer retry or cancel
- **FR-013**: The system MUST create the item in the correct location upon user confirmation
- **FR-014**: The system MUST display a success confirmation after item creation
- **FR-015**: The system MUST request microphone permission before first use and gracefully handle denial without crashing or showing unhandled errors
- **FR-016**: The system MUST NOT require an internet connection for any part of the voice input or item creation flow
- **FR-017**: The system MUST NOT create or modify any inventory data unless the user explicitly taps a confirmation action
- **FR-018**: The system MUST NOT transmit audio or speech data to any external server or service

### Key Entities

- **Voice Session**: A single activation of the microphone from the moment listening begins until the user confirms, cancels, or the session times out. Carries no persistent state — all data is discarded on cancel.
- **Parsed Voice Command**: The structured interpretation of a voice transcript. Contains: raw transcript (string), item name (string), space reference (matched inventory record or unresolved spoken text), container reference (matched inventory record, unresolved spoken text, or absent).
- **Match Result**: The outcome of comparing a spoken name against existing inventory records. Can be: exact match (one record), fuzzy match candidates (list of records), or no match.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add an item to a known location in under 15 seconds from tapping the mic button to seeing the success confirmation
- **SC-002**: For clearly spoken commands matching existing inventory, the correct item name, space, and container are extracted and displayed without correction in at least 90% of attempts under typical indoor conditions
- **SC-003**: When a space or container name is spoken with minor variation or mispronunciation, the correct inventory record appears among the suggested matches in at least 80% of cases
- **SC-004**: No item is ever created without explicit user confirmation — the silent-creation rate is 0%
- **SC-005**: The feature is fully functional with no internet connection — 100% of voice sessions complete successfully offline
- **SC-006**: A complete voice-add session (tap mic → speak → confirm → success) requires no more than 3 taps after the voice command is spoken

## Clarifications

### Session 2026-05-11
- Q: What build approach for `@react-native-voice/voice` native module? → A: EAS Dev Build — custom development client via EAS, managed workflow retained (no eject)
- Q: Default values for quantity and description when adding via voice? → A: Quantity = 1, description = empty — identical to manual add defaults
- Q: Listening timeout duration? → A: 10 seconds — app stops listening and treats as failed capture after 10s of silence
- Q: Parsing strategy for extracting item/space/container from transcript? → A: Keyword extraction — looks for anchor words ("add", "to", "in", "put") and extracts parts around them; handles natural variations without ML dependencies
- Q: Mic button placement and style on dashboard? → A: Floating action button (FAB) bottom-right corner — prominent, always visible, thumb-reachable

## Assumptions

- The microphone button is a floating action button (FAB) positioned in the bottom-right corner of the dashboard screen; it is always visible without scrolling
- Voice recognition processes audio entirely on the user's device using the device's built-in speech engine — no audio is sent to any external service and no API key or subscription is required
- The `@react-native-voice/voice` library is the selected on-device speech recognition solution and requires a custom development build via **EAS Dev Build** (`eas build --profile development`); the project remains in Expo managed workflow — no eject required
- The parsing logic supports English-language commands only in v1; multi-language support is out of scope
- The app's existing Spaces → Containers → Items hierarchy is unchanged; this feature does not add new hierarchy levels or entity types
- Items created via voice input are identical to manually created items — quantity defaults to 1, description defaults to empty, no special metadata flags indicate voice origin
- The system does not auto-create new spaces or containers from spoken names; it only matches against existing inventory records
- Users are expected to speak commands in a form resembling "Add [item] to [space] [container]" or similar natural variations; parsing uses keyword extraction (anchor words: "add", "put", "to", "in") to extract parts — no ML model or external NLP service is required

## Out of Scope

- Creating new spaces or containers via voice input
- Editing or deleting existing items via voice
- Moving items between locations via voice
- Multi-language or dialect support
- Voice input on screens other than the dashboard (out of scope for v1)
- Wake-word activation ("Hey Spotly") — user must tap the mic button manually
- Voice output / text-to-speech confirmation readback
- Offline speech model updates or model selection

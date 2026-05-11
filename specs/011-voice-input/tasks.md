# Tasks: Voice Input

**Input**: [plan.md](./plan.md) · [spec.md](./spec.md) · [data-model.md](./data-model.md) · [contracts/voice-service.ts](./contracts/voice-service.ts)  
**Branch**: `032-voice-input` | **Total tasks**: 9

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallelizable with other [P] tasks in the same phase
- **[US#]**: User story from spec.md

---

## Phase 1: Setup

**Purpose**: Install dependencies and configure the native plugin.

- [X] T001 Install `expo-speech-recognition` and `fuzzysort`, add `"expo-speech-recognition"` plugin to `app/app.json`

---

## Phase 2: Foundational

**Purpose**: Shared TypeScript types used by all other tasks. Must be complete before US phases.

- [X] T002 Create `app/src/features/voice/models/VoiceCommand.ts` with `RawParsedParts`, `ParsedVoiceCommand`, `MatchResult<T>`, and `VoiceSessionState` types per data-model.md

---

## Phase 3: User Story 1 — Add Item to Known Location (P1) 🎯 MVP

**Goal**: User taps FAB, speaks "Add drill to garage shelf", sees confirmation card, taps Add, item is saved.  
**Independent Test**: Speak a complete command with exact space/container names; verify item appears in the correct location.

- [X] T003 [P] [US1] Create `app/src/features/voice/services/VoiceParserService.ts` — regex keyword extraction: strip action verb, split on preposition, return `RawParsedParts`
- [X] T004 [P] [US1] Create `app/src/features/voice/services/VoiceMatcherService.ts` — resolve `RawParsedParts` against spaces/containers arrays using exact match then fuzzysort, return `ParsedVoiceCommand`
- [X] T005 [US1] Create `app/src/features/voice/screens/components/VoiceModal.tsx` — full state machine (idle → listening → processing → confirming → success), mic permission check, 10s timeout, calls `ItemService` on confirm
- [X] T006 [P] [US1] Add FAB (mic button, bottom-right) to `app/src/features/home/screens/HomePage.tsx` and wire up `VoiceModal`

---

## Phase 4: User Story 2 — Ambiguity Handling (P2)

**Goal**: Spoken name not found exactly → show fuzzy suggestions; no match → show picker.  
**Independent Test**: Say "garaj" (fuzzy match for "Garage"); verify "Did you mean: Garage?" is offered.

- [X] T007 [US2] Update `app/src/features/voice/screens/components/VoiceModal.tsx` — handle `status: 'fuzzy'` (show "Did you mean X?" tap-to-confirm) and `status: 'none'` (show space/container pickers) in the confirmation card; disable Add button until both fields are resolved

---

## Phase 5: User Story 3 — Partial Command: No Container (P2)

**Goal**: User says "[item] to [space]" with no container → show container picker before confirming.  
**Independent Test**: Say "Add scissors to office"; verify container picker appears; select one; verify item created.

- [X] T008 [US3] Update `app/src/features/voice/screens/components/VoiceModal.tsx` — handle `container: 'absent'` when matched space has containers (show picker) or has no containers (hide field and allow direct confirm)

---

## Phase 6: User Story 4 — Retry and Cancel (P3)

**Goal**: Failed capture or wrong result → user can retry or cancel with no side effects.  
**Independent Test**: Let listening time out (10s silence); verify error state shown with "Try Again" and "Cancel" options; tap Cancel → no item created.

- [X] T009 [US4] Update `app/src/features/voice/screens/components/VoiceModal.tsx` — wire "Try Again" to restart listening from error and confirming phases; wire "Cancel" to close modal at any phase without creating data; verify timeout (already in T005) surfaces as the error state

---

## Dependencies

```
T001 (deps installed)
  └── T002 (types)
        ├── T003 (VoiceParserService)  ─┐
        ├── T004 (VoiceMatcherService) ─┤ all feed into
        └── T005 (VoiceModal core)     ─┘
              ├── T007 (ambiguity UI)
              ├── T008 (partial command UI)
              └── T009 (retry/cancel)
T006 (FAB in HomePage) — parallel with T005, depends only on T002
```

## Parallel Execution

US1 is the only phase with parallel opportunities:

```
T003 VoiceParserService.ts  ──┐
T004 VoiceMatcherService.ts ──┤ parallel (different files)
T006 FAB in HomePage.tsx    ──┘
```

T005 (VoiceModal core) must follow T003 and T004 since it calls both services.  
T007, T008, T009 are sequential edits to VoiceModal.tsx — do not parallelize.

## Implementation Strategy

**MVP = Phase 1 + Phase 2 + Phase 3** (T001–T006)

Delivers the complete happy-path: install → types → parser → matcher → modal → FAB.  
User can add an item to a known, exactly-matched location. Real-world usable.

**Phase 4–6** add resilience (fuzzy suggestions, partial input, retry/cancel) but MVP works without them.

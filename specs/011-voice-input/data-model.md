# Data Model: Voice Input Feature

**Feature**: 011-voice-input  
**Date**: May 11, 2026

---

## New Types (in-memory only — no DB changes)

The voice input feature introduces **no new database tables or schema migrations**. All data is transient (lives only for the duration of a voice session) and is discarded on cancel or completion.

---

## TypeScript Interfaces

### ParsedVoiceCommand

The structured result of parsing a raw speech transcript. Carries all extracted and resolved data needed to display the confirmation card.

```typescript
/**
 * The result of parsing a raw voice transcript.
 * All fields are populated after parsing + fuzzy matching.
 * Passed from VoiceParserService to the VoiceConfirmModal.
 */
export interface ParsedVoiceCommand {
  /** The original transcript from the speech recognizer */
  raw: string;

  /** Extracted item name (always a string if parsing succeeded; null if parse failed) */
  itemName: string | null;

  /** Resolved space — exact DB record if matched, unresolved string if not */
  space: MatchResult<Space>;

  /** Resolved container — exact DB record if matched, unresolved if not, absent if not spoken */
  container: MatchResult<Container> | 'absent';
}
```

---

### MatchResult\<T\>

Generic type representing the outcome of matching a spoken name against inventory records.

```typescript
/**
 * The outcome of fuzzy-matching a spoken name against an inventory list.
 *
 * - 'exact': spoken name matched one record exactly (case-insensitive)
 * - 'fuzzy': spoken name matched one or more records approximately
 * - 'none': no match found
 */
export type MatchResult<T> =
  | { status: 'exact'; record: T }
  | { status: 'fuzzy'; candidates: T[]; spoken: string }
  | { status: 'none'; spoken: string };
```

---

### VoiceSessionState

UI state machine for the voice flow, used in the `VoiceModal` component.

```typescript
/**
 * State machine for the voice session UI.
 *
 *  idle → listening → processing → confirming → success
 *                ↓          ↓
 *              error      error
 *                ↓          ↓
 *            (retry?)   (retry?)
 */
export type VoiceSessionState =
  | { phase: 'idle' }
  | { phase: 'listening' }                          // mic is active
  | { phase: 'processing' }                         // transcript received, parsing
  | { phase: 'confirming'; parsed: ParsedVoiceCommand }  // showing confirmation card
  | { phase: 'success'; itemName: string; location: string }  // item created
  | { phase: 'error'; message: string };            // failed capture or parse error
```

---

## Data Flow

```
User taps FAB
    ↓
VoiceModal opens (phase: idle → listening)
    ↓
expo-speech-recognition fires 'result' event
    ↓
VoiceParserService.parse(transcript)          // keyword extraction
    ↓
VoiceMatcherService.resolve(parsed, spaces, containers)  // fuzzy matching
    ↓
VoiceModal shows confirming card (phase: confirming)
    ↓
User taps "Add"
    ↓
ItemService.createItem(...)                   // existing service, no changes
    ↓
phase: success → modal closes
```

---

## Existing Entities Used (No Changes)

| Entity | Source | Used For |
|--------|--------|----------|
| `Space` | `src/models/Space.ts` | Matching against space candidates |
| `Container` | `src/models/Container.ts` | Matching against container candidates |
| `SpaceRepository.getAllSpaces()` | Existing | Fetch all spaces for matching |
| `ContainerService.getContainersBySpaceId()` | Existing | Fetch containers in resolved space |
| `ItemService.createItemInContainer()` / `createItem()` | Existing | Create item after confirmation |

No new repositories or service methods are needed on existing entities.

---

## New Files Created

```
app/src/features/voice/
├── models/
│   └── VoiceCommand.ts          ← ParsedVoiceCommand, MatchResult, VoiceSessionState
├── services/
│   ├── VoiceParserService.ts    ← keyword extraction: transcript → raw parsed parts
│   └── VoiceMatcherService.ts   ← fuzzy matching: raw parts → resolved MatchResult<T>
└── screens/
    └── components/
        └── VoiceModal.tsx       ← Full voice session UI (listening → confirm → success)
```

FAB button lives in the existing `HomePage.tsx` — no new screen needed.

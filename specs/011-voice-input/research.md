# Research: Voice Input Feature

**Feature**: 011-voice-input  
**Date**: May 11, 2026  
**Branch**: 032-voice-input

---

## Decision 1: Speech Recognition Library

**Decision**: Use `expo-speech-recognition` v3.1.3 (NOT `@react-native-voice/voice`)

**Rationale**: `@react-native-voice/voice` was officially **archived and deprecated on January 31, 2026**. It is no longer maintained. `expo-speech-recognition` is the actively maintained successor built specifically for Expo workflows with a modern API.

**Alternatives Considered**:
| Library | Status | Verdict |
|---------|--------|---------|
| `@react-native-voice/voice` v4.0.1 | ❌ Archived Jan 2026 | Rejected |
| `expo-speech-recognition` v3.1.3 | ✅ Active | Selected |
| Google Cloud Speech-to-Text API | Paid, requires internet | Rejected |
| OpenAI Whisper API | Paid, requires internet | Rejected |

**Integration Notes**:
- Requires EAS Dev Build (`developmentClient: true`) — already configured in `eas.json`
- Add plugin to `app.json`: `"plugins": ["expo-speech-recognition"]`
- **Android**: Requires `RECORD_AUDIO` permission (config plugin handles this)
- **iOS**: Requires `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription` in Info.plist (config plugin handles this)
- Locale: `en-US` for v1

**API Surface**:
```typescript
import {
  useSpeechRecognitionEvent,
  ExpoSpeechRecognitionModule,
  getSupportedLocales,
} from 'expo-speech-recognition';

// Start listening
ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false });

// Events
useSpeechRecognitionEvent('result', (event) => { /* event.results[0].transcript */ });
useSpeechRecognitionEvent('error', (event) => { /* event.error, event.message */ });
useSpeechRecognitionEvent('end', () => { /* listening stopped */ });
```

---

## Decision 2: Fuzzy Matching Library

**Decision**: Use `fuzzysort` (not `fuse.js`)

**Rationale**: For matching 5–20 inventory names against a spoken string, fuzzysort is lighter (~5 KB vs ~8 KB), faster, and has a simpler API. Fuse.js is more configurable but overkill for this scale.

**Alternatives Considered**:
| Library | Size | API Complexity | Verdict |
|---------|------|----------------|---------|
| `fuzzysort` | ~5 KB | Simple | Selected |
| `fuse.js` v7.3.0 | ~8 KB | Moderate | Rejected (overkill) |
| Manual Levenshtein | 0 KB | Custom | Rejected (reinventing) |

**Usage Pattern**:
```typescript
import fuzzysort from 'fuzzysort';

const spaceNames = spaces.map(s => s.name); // ['Garage', 'Office', 'Bedroom']
const results = fuzzysort.go(spokenSpaceName, spaceNames, { limit: 3, threshold: -10000 });

if (results.length === 0) {
  // no match found
} else if (results.length === 1) {
  // single best match → suggest
} else {
  // multiple candidates → show picker
}
```

**Matching Strategy**:
1. Try exact match first (case-insensitive)
2. Fall back to fuzzysort for fuzzy candidates
3. If score < threshold → treat as "no match" → show picker

---

## Decision 3: Command Parsing Strategy

**Decision**: Regex-based keyword extraction with anchor words

**Rationale**: Covers 90%+ of real commands with zero dependencies, fully offline, fast, deterministic, and easy to test. No ML model, no API, no heavy library.

**Anchor Words**:
- Action verbs: `add`, `put`, `place`, `store`, `save`
- Prepositions: `to`, `in`, `into`, `inside`, `at`

**Parsing Algorithm**:
```typescript
function parseVoiceCommand(transcript: string): ParsedVoiceCommand {
  // Normalize: lowercase, trim
  const text = transcript.toLowerCase().trim();
  
  // Pattern: [verb] [item] [preposition] [space] [container?]
  const pattern = /^(?:add|put|place|store|save)\s+(.+?)\s+(?:to|in|into|inside|at)\s+(.+)$/i;
  const match = pattern.exec(text);
  
  if (!match) return { raw: transcript, item: null, space: null, container: null };
  
  const itemPart = match[1].trim();      // everything before preposition
  const locationPart = match[2].trim();  // everything after preposition
  
  // Location may be "space container" or just "space"
  // Fuzzy-match the full locationPart against space names
  // If no full match, try first word as space, rest as container
  
  return resolveLocation(itemPart, locationPart);
}
```

**Location Resolution Order**:
1. Try fuzzy match of full `locationPart` against all space names
2. If match → space resolved, container = null (prompt picker if space has containers)
3. If no match → split: first word(s) = space candidate, remaining = container candidate
4. Fuzzy-match space candidate against space names
5. If space matched → fuzzy-match container candidate against containers in that space
6. If nothing matches → return unresolved (show picker for space)

**Test Cases**:
| Input | item | space | container |
|-------|------|-------|-----------|
| "Add drill to garage shelf" | drill | Garage | Shelf |
| "Put scissors in office drawer" | scissors | Office | Drawer |
| "Add headphones to bedroom" | headphones | Bedroom | null (prompt) |
| "Store passport in office top drawer" | passport | Office | Top Drawer |
| "Add thing to nonexistentplace" | thing | unresolved | unresolved |

---

## Decision 4: FAB Implementation

**Decision**: Use `TouchableOpacity` with absolute positioning (no external library)

**Rationale**: Consistent with existing Spotly convention of no external UI libraries. A FAB is just a circular button with `position: absolute`, `bottom`, `right` — trivial to implement inline.

**Pattern**:
```typescript
// In HomePage render, above ScrollView's closing sibling
<TouchableOpacity
  style={styles.fab}
  onPress={openVoiceModal}
  activeOpacity={0.85}
>
  <FontAwesomeIcon icon={faMicrophone} size={22} color="#fff" />
</TouchableOpacity>

// StyleSheet
fab: {
  position: 'absolute',
  bottom: tabBarHeight + 16,
  right: 20,
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: PRIMARY,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 5,
},
```

---

## Gotchas & Risk Register

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Google Speech Recognizer not installed on Android device | Medium | Show clear error: "Speech recognition not available on this device" |
| iOS user denies mic permission | Medium | Show permission rationale screen; gracefully disable FAB with explanation |
| Speech recognizer returns empty string | Low | Treat as failed capture; show "Didn't catch that — try again" |
| Multi-word space names (e.g., "Living Room") | Medium | Split location heuristically; fuzzy match handles variations |
| No internet on Android (Google requires brief network) | Low | Show error message if recognizer fails to start |
| EAS Dev Build required — Expo Go won't work | High (known) | Documented in spec; not a bug but must be communicated to testers |

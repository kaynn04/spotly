# Quick Start: Voice Input Implementation

**Feature**: 011-voice-input  
**Branch**: 032-voice-input  
**Date**: May 11, 2026

This guide walks through the complete implementation in the correct dependency order.

---

## Step 1: Install Dependencies

```bash
cd app
npx expo install expo-speech-recognition fuzzysort
```

Add the plugin to `app.json`:
```json
{
  "expo": {
    "plugins": [
      "expo-speech-recognition"
    ]
  }
}
```

Build a new dev client (required for native module):
```bash
eas build --profile development --platform android
```

---

## Step 2: VoiceParserService

`app/src/features/voice/services/VoiceParserService.ts`

```typescript
import { RawParsedParts } from '../models/VoiceCommand';

/**
 * Extracts item name, space, and container from a natural language transcript.
 * Uses regex keyword extraction — no external dependencies, fully offline.
 */
export class VoiceParserService {
  // Action verbs that indicate an "add" intent
  private static readonly ACTION_VERBS = /^(?:add|put|place|store|save)\s+/i;
  // Prepositions that separate item from location
  private static readonly PREPOSITION = /\s+(?:to|in|into|inside|at)\s+/i;

  static parse(transcript: string): RawParsedParts {
    const raw = transcript;
    const text = transcript.trim();

    // Must start with a recognized action verb
    if (!this.ACTION_VERBS.test(text)) {
      return { raw, itemName: null, spokenSpace: null, spokenContainer: null };
    }

    // Remove leading verb
    const withoutVerb = text.replace(this.ACTION_VERBS, '');

    // Split on preposition
    const prepMatch = this.PREPOSITION.exec(withoutVerb);
    if (!prepMatch) {
      // No preposition found — whole thing may be item name only
      return { raw, itemName: withoutVerb.trim() || null, spokenSpace: null, spokenContainer: null };
    }

    const itemName = withoutVerb.slice(0, prepMatch.index).trim() || null;
    const locationPart = withoutVerb.slice(prepMatch.index + prepMatch[0].length).trim();

    if (!locationPart) {
      return { raw, itemName, spokenSpace: null, spokenContainer: null };
    }

    // locationPart may be "garage shelf" or just "garage"
    // We'll pass the full string to VoiceMatcherService to resolve
    // Split on first space as a heuristic: first word = space, rest = container
    const spaceEndIdx = locationPart.indexOf(' ');
    const spokenSpace = spaceEndIdx === -1 ? locationPart : locationPart.slice(0, spaceEndIdx);
    const spokenContainer = spaceEndIdx === -1 ? null : locationPart.slice(spaceEndIdx + 1).trim() || null;

    return { raw, itemName, spokenSpace, spokenContainer };
  }
}
```

---

## Step 3: VoiceMatcherService

`app/src/features/voice/services/VoiceMatcherService.ts`

```typescript
import fuzzysort from 'fuzzysort';
import { RawParsedParts, ParsedVoiceCommand, MatchResult } from '../models/VoiceCommand';
import type { Space } from '@/src/models/Space';
import type { Container } from '@/src/models/Container';

export class VoiceMatcherService {
  private static readonly FUZZY_THRESHOLD = -10000; // fuzzysort score cutoff

  static resolve(
    parts: RawParsedParts,
    spaces: Space[],
    containers: Container[]
  ): ParsedVoiceCommand {
    const space = this.matchSpace(parts.spokenSpace, spaces);
    const container = parts.spokenContainer === null
      ? 'absent'
      : this.matchContainer(parts.spokenContainer, containers);

    return {
      raw: parts.raw,
      itemName: parts.itemName,
      space,
      container,
    };
  }

  private static matchSpace(spoken: string | null, spaces: Space[]): MatchResult<Space> {
    if (!spoken) return { status: 'none', spoken: '' };

    // 1. Try exact match (case-insensitive)
    const exact = spaces.find(s => s.name.toLowerCase() === spoken.toLowerCase());
    if (exact) return { status: 'exact', record: exact };

    // 2. Try fuzzy match
    const names = spaces.map(s => s.name);
    const results = fuzzysort.go(spoken, names, {
      limit: 3,
      threshold: this.FUZZY_THRESHOLD,
    });

    if (results.length === 0) return { status: 'none', spoken };

    const candidates = results.map(r => spaces.find(s => s.name === r.target)!);
    if (candidates.length === 1) return { status: 'fuzzy', candidates, spoken };
    return { status: 'fuzzy', candidates, spoken };
  }

  private static matchContainer(spoken: string, containers: Container[]): MatchResult<Container> {
    if (!spoken) return { status: 'none', spoken };

    const exact = containers.find(c => c.name.toLowerCase() === spoken.toLowerCase());
    if (exact) return { status: 'exact', record: exact };

    const names = containers.map(c => c.name);
    const results = fuzzysort.go(spoken, names, {
      limit: 3,
      threshold: this.FUZZY_THRESHOLD,
    });

    if (results.length === 0) return { status: 'none', spoken };

    const candidates = results.map(r => containers.find(c => c.name === r.target)!);
    return { status: 'fuzzy', candidates, spoken };
  }
}
```

---

## Step 4: VoiceModal Component (Skeleton)

`app/src/features/voice/screens/components/VoiceModal.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMicrophone, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VoiceParserService } from '../../services/VoiceParserService';
import { VoiceMatcherService } from '../../services/VoiceMatcherService';
import { SpaceService } from '@/src/services/SpaceService';
import { ContainerService } from '@/src/services/ContainerService';
import { ItemService } from '@/src/services/ItemService';
import { VoiceSessionState, ParsedVoiceCommand } from '../../models/VoiceCommand';

const PRIMARY = '#6b7f99';
const TIMEOUT_MS = 10000; // 10 second listening timeout

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function VoiceModal({ visible, onClose }: Props) {
  const [state, setState] = useState<VoiceSessionState>({ phase: 'idle' });
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useSpeechRecognitionEvent('result', async (event) => {
    clearTimeout(timeoutRef.current);
    await ExpoSpeechRecognitionModule.stop();
    const transcript = event.results[0]?.transcript ?? '';
    if (!transcript) {
      setState({ phase: 'error', message: "Didn't catch that — try again" });
      return;
    }
    setState({ phase: 'processing' });
    await processTranscript(transcript);
  });

  useSpeechRecognitionEvent('error', (event) => {
    clearTimeout(timeoutRef.current);
    setState({ phase: 'error', message: event.message || "Didn't catch that — try again" });
  });

  const startListening = async () => {
    setState({ phase: 'listening' });
    await ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false });
    // Manual 10-second timeout
    timeoutRef.current = setTimeout(async () => {
      await ExpoSpeechRecognitionModule.stop();
      setState({ phase: 'error', message: 'Listening timed out — try again' });
    }, TIMEOUT_MS);
  };

  const processTranscript = async (transcript: string) => {
    const spaces = await SpaceService.getAllSpaces();
    const parts = VoiceParserService.parse(transcript);

    if (!parts.itemName) {
      setState({ phase: 'error', message: "Couldn't understand the item name — try again" });
      return;
    }

    // Fetch containers for matched space (if space resolved)
    let containers = [];
    if (parts.spokenSpace) {
      const spaceMatch = VoiceMatcherService.resolve(parts, spaces, []);
      if (spaceMatch.space.status === 'exact') {
        containers = await ContainerService.getContainersBySpaceId(spaceMatch.space.record.id);
      }
    }

    const parsed = VoiceMatcherService.resolve(parts, spaces, containers);
    setState({ phase: 'confirming', parsed });
  };

  const handleConfirm = async (spaceId: string, containerId: string | null, itemName: string) => {
    try {
      await ItemService.createItem({ name: itemName, spaceId, containerId, quantity: 1, description: '' });
      const location = /* derive location string */ itemName;
      setState({ phase: 'success', itemName, location });
      setTimeout(onClose, 1500);
    } catch {
      setState({ phase: 'error', message: 'Failed to add item — try again' });
    }
  };

  // ... render based on state.phase
}
```

---

## Step 5: FAB in HomePage

Add to `app/src/features/home/screens/HomePage.tsx`:

```typescript
// Import
import { faMicrophone } from '@fortawesome/free-solid-svg-icons';
import VoiceModal from '@/src/features/voice/screens/components/VoiceModal';

// State
const [voiceModalVisible, setVoiceModalVisible] = useState(false);

// In JSX (sibling to ScrollView, inside SafeAreaView)
<TouchableOpacity
  style={[styles.fab, { bottom: tabBarPadding + 16 }]}
  onPress={() => setVoiceModalVisible(true)}
  activeOpacity={0.85}
>
  <FontAwesomeIcon icon={faMicrophone} size={22} color="#fff" />
</TouchableOpacity>

<VoiceModal
  visible={voiceModalVisible}
  onClose={() => { setVoiceModalVisible(false); loadData(); }}
/>

// Style
fab: {
  position: 'absolute',
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

## File Map

```
app/
├── app.json                              ← Add expo-speech-recognition plugin
├── src/
│   └── features/
│       └── voice/
│           ├── models/
│           │   └── VoiceCommand.ts       ← ParsedVoiceCommand, MatchResult, VoiceSessionState
│           ├── services/
│           │   ├── VoiceParserService.ts ← Keyword extraction (regex)
│           │   └── VoiceMatcherService.ts ← Fuzzy matching (fuzzysort)
│           └── screens/
│               └── components/
│                   └── VoiceModal.tsx    ← Full modal UI
└── features/home/screens/HomePage.tsx   ← Add FAB + VoiceModal
```

**No DB migrations required.** No existing services modified.

import type { Space } from '@/src/models/Space';
import type { Container } from '@/src/models/Container';

/**
 * The outcome of fuzzy-matching a spoken name against an inventory list.
 *
 * - 'exact':  spoken name matched one record exactly (case-insensitive)
 * - 'fuzzy':  spoken name matched one or more records approximately
 * - 'none':   no match found
 */
export type MatchResult<T> =
  | { status: 'exact'; record: T }
  | { status: 'fuzzy'; candidates: T[]; spoken: string }
  | { status: 'none'; spoken: string };

/**
 * The action the user intends to perform.
 */
export type VoiceAction = 'add' | 'move' | 'find' | 'create-space' | 'create-container' | 'lend' | 'return';

/**
 * Raw parts extracted from a transcript before fuzzy matching.
 * All location fields nullable — null means not found in transcript.
 */
export interface RawParsedParts {
  raw: string;
  action: VoiceAction;
  itemName: string | null;  // Single item (used by move, find, lend, return)
  itemNames?: string[] | null;  // Multiple items (used by add action)
  spokenSpace: string | null;
  spokenContainer: string | null;
}

/**
 * Fully resolved command after fuzzy matching against inventory.
 * Passed to the confirmation card.
 */
export interface ParsedVoiceCommand {
  raw: string;
  action: VoiceAction;
  itemName: string | null;
  space: MatchResult<Space>;
  /** 'absent' means the user did not mention a container at all */
  container: MatchResult<Container> | 'absent';
}

/**
 * UI state machine for the voice session modal.
 */
export type VoiceSessionState =
  | { phase: 'idle' }
  | { phase: 'listening' }
  | { phase: 'processing' }
  | { phase: 'confirming'; parsed: ParsedVoiceCommand; itemNames?: string[]; editedItemName?: string }
  | { phase: 'confirming-space'; spaceName: string }
  | { phase: 'confirming-container'; containerName: string; spaceResult: MatchResult<Space> }
  | { phase: 'confirming-lend'; itemName: string; borrowerName: string; matchedItem: import('@/src/models/Item').Item | null }
  | { phase: 'confirming-return'; lendingId: string; itemName: string; borrowerName: string }
  | { phase: 'success'; action: VoiceAction; itemName: string; location: string }
  | { phase: 'found'; items: import('@/src/models/Item').Item[] }
  | { phase: 'error'; message: string; transcript?: string; detectedAction?: VoiceAction }
  | { phase: 'needs-permission' }
  | { phase: 'needs-install' }
  | { phase: 'needs-language' };

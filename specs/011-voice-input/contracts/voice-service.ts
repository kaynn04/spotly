/**
 * VoiceService Contracts
 * Feature: 011-voice-input
 *
 * Defines the interfaces for VoiceParserService and VoiceMatcherService.
 * These are pure TypeScript services with no side effects.
 * No database interaction — they work with data passed in.
 */

import type { Space } from '../../src/models/Space';
import type { Container } from '../../src/models/Container';

// ─── Core Types ──────────────────────────────────────────────────────────────

/**
 * The outcome of fuzzy-matching a spoken name against an inventory list.
 */
export type MatchResult<T> =
  | { status: 'exact'; record: T }
  | { status: 'fuzzy'; candidates: T[]; spoken: string }
  | { status: 'none'; spoken: string };

/**
 * The raw parsed parts extracted from a transcript before fuzzy matching.
 * All fields are nullable — null means that part was not found in the transcript.
 */
export interface RawParsedParts {
  raw: string;         // Original transcript
  itemName: string | null;
  spokenSpace: string | null;
  spokenContainer: string | null;
}

/**
 * The fully resolved result after fuzzy matching.
 * This is what is shown in the confirmation card.
 */
export interface ParsedVoiceCommand {
  raw: string;
  itemName: string | null;
  space: MatchResult<Space>;
  container: MatchResult<Container> | 'absent';
}

/**
 * UI state machine phases for the voice session.
 */
export type VoiceSessionState =
  | { phase: 'idle' }
  | { phase: 'listening' }
  | { phase: 'processing' }
  | { phase: 'confirming'; parsed: ParsedVoiceCommand }
  | { phase: 'success'; itemName: string; location: string }
  | { phase: 'error'; message: string };

// ─── VoiceParserService Interface ────────────────────────────────────────────

/**
 * VoiceParserService
 *
 * Extracts item name, spoken space, and spoken container from a raw transcript.
 * Uses regex keyword extraction — no external dependencies.
 * Returns null fields for parts that could not be extracted.
 *
 * @example
 * VoiceParserService.parse('Add drill to garage shelf')
 * // → { raw: 'Add drill to garage shelf', itemName: 'drill', spokenSpace: 'garage', spokenContainer: 'shelf' }
 *
 * VoiceParserService.parse('Add scissors to office')
 * // → { raw: 'Add scissors to office', itemName: 'scissors', spokenSpace: 'office', spokenContainer: null }
 *
 * VoiceParserService.parse('something unrecognizable')
 * // → { raw: '...', itemName: null, spokenSpace: null, spokenContainer: null }
 */
export interface IVoiceParserService {
  /**
   * Parse a raw speech transcript into structured parts.
   * Does NOT perform inventory lookup — purely lexical extraction.
   */
  parse(transcript: string): RawParsedParts;
}

// ─── VoiceMatcherService Interface ───────────────────────────────────────────

/**
 * VoiceMatcherService
 *
 * Resolves raw parsed parts against the user's inventory using fuzzy matching.
 * Takes all spaces and produces a fully resolved ParsedVoiceCommand.
 *
 * @example
 * const spaces = [{ id: '1', name: 'Garage', ... }];
 * const containers = [{ id: '10', name: 'Shelf', spaceId: '1', ... }];
 *
 * VoiceMatcherService.resolve(
 *   { itemName: 'drill', spokenSpace: 'garaj', spokenContainer: 'shelf' },
 *   spaces,
 *   containers
 * )
 * // → {
 * //   itemName: 'drill',
 * //   space: { status: 'fuzzy', candidates: [{ id: '1', name: 'Garage' }], spoken: 'garaj' },
 * //   container: { status: 'exact', record: { id: '10', name: 'Shelf' } }
 * // }
 */
export interface IVoiceMatcherService {
  /**
   * Resolve raw spoken parts against inventory records.
   *
   * @param parts     - Output of VoiceParserService.parse()
   * @param spaces    - All spaces from SpaceRepository
   * @param containers - Containers to match against (pass containers for the matched space)
   */
  resolve(
    parts: RawParsedParts,
    spaces: Space[],
    containers: Container[]
  ): ParsedVoiceCommand;
}

// ─── Confirmation Input ───────────────────────────────────────────────────────

/**
 * The confirmed data passed to ItemService after user taps "Add".
 * Space and container must be fully resolved (exact records) at this point.
 * Unresolved fields are not permitted — UI enforces this before calling confirm.
 */
export interface VoiceConfirmedItem {
  itemName: string;
  spaceId: string;
  containerId: string | null;   // null = add to space root
}

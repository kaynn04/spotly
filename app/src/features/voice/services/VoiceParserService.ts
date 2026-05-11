import type { RawParsedParts, VoiceAction } from '../models/VoiceCommand';

/**
 * VoiceParserService
 *
 * Extracts action, item name, space name, and container name from a natural language transcript.
 * Pure function — no side effects, no async, no external calls.
 *
 * Supported patterns:
 *   [add verb] [item] [preposition] [space] [container?]
 *   [move verb] [item] [preposition] [space] [container?]
 *
 * Examples:
 *   "Add drill to living room shelf" → { action: 'add', itemName: "drill", spokenSpace: "living room", spokenContainer: "shelf" }
 *   "Move drill to bedroom" → { action: 'move', itemName: "drill", spokenSpace: "bedroom", spokenContainer: null }
 *
 * @param knownSpaceNames  Optional list of actual space names from the DB. When provided,
 *                         the parser uses greedy longest-match so multi-word space names
 *                         (e.g. "Living Room", "Tool Shed") are correctly separated from
 *                         the container portion of the utterance.
 */
export class VoiceParserService {
  static splitItems(text: string): string[] {
    // Split on commas and " and " to handle speech recognition output.
    // Speech recognition rarely inserts commas, so "keyboard, mouse and headset"
    // often comes out as "keyboard mouse and headset" or "keyboard and mouse and headset".
    // Step 1: split on commas.
    // Step 2: within each comma-segment, split further on " and ".
    // Step 3: strip any remaining leading/trailing whitespace.
    // Examples:
    //   "mouse, keyboard, and headset" → ["mouse", "keyboard", "headset"]
    //   "keyboard mouse and headset"   → ["keyboard mouse", "headset"]
    //   "keyboard and mouse and headset" → ["keyboard", "mouse", "headset"]
    //   "mouse, keyboard"              → ["mouse", "keyboard"]
    const commaParts = text.split(/,/);
    const items: string[] = [];
    for (const part of commaParts) {
      const stripped = part.replace(/^\s*and\s+/i, '').trim();
      if (!stripped) continue;
      // Further split on " and " within each comma segment
      const andParts = stripped.split(/\s+and\s+/i).map(s => s.trim()).filter(s => s.length > 0);
      items.push(...andParts);
    }
    return items.length > 0 ? items : [];
  }
  private static readonly ADD_VERBS = /^(?:add|put|place|store|save)\s+/i;
  private static readonly MOVE_VERBS = /^(?:move|transfer|relocate)\s+/i;
  private static readonly FIND_VERBS = /^(?:find|search|search for|where is|where's|locate|look for)\s+/i;
  private static readonly CREATE_SPACE_VERBS = /^(?:create|new|make|add)\s+(?:a\s+)?(?:space|room|area|location|place)(?:\s+(?:called|named))?\s+/i;
  private static readonly CREATE_CONTAINER_VERBS = /^(?:create|new|make|add)\s+(?:a\s+)?(?:container|box|shelf|bin|drawer|cabinet|bag|basket|folder)(?:\s+(?:called|named))?\s+/i;
  private static readonly LEND_VERBS = /^(?:lend|loan|borrow|give)\s+/i;
  private static readonly RETURN_VERBS = /^(?:return|returned|mark|got back|back)\s+/i;
  private static readonly PREPOSITION = /\s+(?:to|in|into|inside|at)\s+/i;

  static parse(transcript: string, knownSpaceNames: string[] = []): RawParsedParts {
    const raw = transcript;
    const text = transcript.trim();

    // Determine action from leading verb
    let action: VoiceAction;
    let withoutVerb: string;

    if (this.CREATE_SPACE_VERBS.test(text)) {
      const spaceName = text.replace(this.CREATE_SPACE_VERBS, '').trim() || null;
      return { raw, action: 'create-space', itemName: null, spokenSpace: spaceName, spokenContainer: null };
    }

    if (this.CREATE_CONTAINER_VERBS.test(text)) {
      // After verb: "[containerName] in [spaceName]"
      const rest = text.replace(this.CREATE_CONTAINER_VERBS, '').trim();
      const prepMatch = this.PREPOSITION.exec(rest);
      if (!prepMatch) {
        // No space mentioned — container name only
        return { raw, action: 'create-container', itemName: rest || null, spokenSpace: null, spokenContainer: null };
      }
      const containerName = rest.slice(0, prepMatch.index).trim() || null;
      const spaceName = rest.slice(prepMatch.index + prepMatch[0].length).trim() || null;
      return { raw, action: 'create-container', itemName: containerName, spokenSpace: spaceName, spokenContainer: null };
    }

    if (this.LEND_VERBS.test(text)) {      // Pattern: "lend [item] to [borrower]"
      const rest = text.replace(this.LEND_VERBS, '').trim();
      const prepMatch = this.PREPOSITION.exec(rest);
      if (!prepMatch) {
        // No borrower mentioned — item name only
        return { raw, action: 'lend', itemName: rest || null, spokenSpace: null, spokenContainer: null };
      }
      const itemName = rest.slice(0, prepMatch.index).trim() || null;
      const borrowerName = rest.slice(prepMatch.index + prepMatch[0].length).trim() || null;
      // Reuse spokenSpace field to carry borrower name
      return { raw, action: 'lend', itemName, spokenSpace: borrowerName, spokenContainer: null };
    }

    // Pattern: "return [item]" / "returned [item]" / "[item] is back" / "[item] returned"
    if (this.RETURN_VERBS.test(text)) {
      const itemName = text.replace(this.RETURN_VERBS, '').replace(/\s+(is\s+)?back$/i, '').trim() || null;
      return { raw, action: 'return', itemName, spokenSpace: null, spokenContainer: null };
    }
    // Suffix patterns: "[item] is back" / "[item] returned"
    const isBackMatch = text.match(/^(.+?)\s+is\s+back$/i);
    if (isBackMatch) {
      return { raw, action: 'return', itemName: isBackMatch[1].trim(), spokenSpace: null, spokenContainer: null };
    }
    const returnedSuffixMatch = text.match(/^(.+?)\s+returned$/i);
    if (returnedSuffixMatch) {
      return { raw, action: 'return', itemName: returnedSuffixMatch[1].trim(), spokenSpace: null, spokenContainer: null };
    }

    if (this.ADD_VERBS.test(text)) {
      action = 'add';
      withoutVerb = text.replace(this.ADD_VERBS, '');
    } else if (this.MOVE_VERBS.test(text)) {
      action = 'move';
      withoutVerb = text.replace(this.MOVE_VERBS, '');
    } else if (this.FIND_VERBS.test(text)) {
      action = 'find';
      withoutVerb = text.replace(this.FIND_VERBS, '');
      // Find action: everything after the verb is the item name, no location needed
      const itemName = withoutVerb.trim() || null;
      return { raw, action, itemName, spokenSpace: null, spokenContainer: null };
    } else {
      return { raw, action: 'add', itemName: null, spokenSpace: null, spokenContainer: null };
    }

    // Split on preposition
    const prepMatch = this.PREPOSITION.exec(withoutVerb);
    if (!prepMatch) {
      // No preposition → item name only, no location
      const itemNameOrNames = withoutVerb.trim() || null;
      if (action === 'add' && itemNameOrNames) {
        const items = this.splitItems(itemNameOrNames);
        return { raw, action, itemName: null, itemNames: items.length > 0 ? items : null, spokenSpace: null, spokenContainer: null };
      }
      return { raw, action, itemName: itemNameOrNames, itemNames: null, spokenSpace: null, spokenContainer: null };
    }

    const itemNameOrNames = withoutVerb.slice(0, prepMatch.index).trim() || null;
    const locationPart = withoutVerb.slice(prepMatch.index + prepMatch[0].length).trim();

    if (!locationPart) {
      if (action === 'add' && itemNameOrNames) {
        const items = this.splitItems(itemNameOrNames);
        return { raw, action, itemName: null, itemNames: items.length > 0 ? items : null, spokenSpace: null, spokenContainer: null };
      }
      return { raw, action, itemName: itemNameOrNames, itemNames: null, spokenSpace: null, spokenContainer: null };
    }

    // For add action with location: split multiple item names
    let itemNames: string[] | null = null;
    let singleItemName: string | null = null;
    if (action === 'add' && itemNameOrNames) {
      const items = this.splitItems(itemNameOrNames);
      itemNames = items.length > 0 ? items : null;
    } else {
      singleItemName = itemNameOrNames;
    }

    // Greedy longest-match against known space names (handles multi-word names like "Living Room").
    // Sort longest-first so "Tool Shed" is tried before "Tool".
    if (knownSpaceNames.length > 0) {
      const locationLower = locationPart.toLowerCase();
      const sorted = [...knownSpaceNames].sort((a, b) => b.length - a.length);
      for (const name of sorted) {
        const nameLower = name.toLowerCase();
        if (locationLower.startsWith(nameLower)) {
          const spokenSpace = locationPart.slice(0, name.length);
          const spokenContainer = locationPart.slice(name.length).trim() || null;
          return { raw, action, itemName: singleItemName, itemNames, spokenSpace, spokenContainer };
        }
      }
    }

    // Fallback: split at first space (single-word space name)
    const spaceBreak = locationPart.indexOf(' ');
    if (spaceBreak === -1) {
      return { raw, action, itemName: singleItemName, itemNames, spokenSpace: locationPart, spokenContainer: null };
    }

    const spokenSpace = locationPart.slice(0, spaceBreak);
    const spokenContainer = locationPart.slice(spaceBreak + 1).trim() || null;
    return { raw, action, itemName: singleItemName, itemNames, spokenSpace, spokenContainer };
  }
}

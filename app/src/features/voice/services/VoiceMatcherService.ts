import fuzzysort from 'fuzzysort';
import type { Space } from '@/src/models/Space';
import type { Container } from '@/src/models/Container';
import type { RawParsedParts, ParsedVoiceCommand, MatchResult } from '../models/VoiceCommand';

/**
 * VoiceMatcherService
 *
 * Resolves raw spoken words from VoiceParserService against the user's actual inventory.
 * Uses case-insensitive exact match first, then fuzzysort for approximate matching.
 * Pure function — caller provides the full lists; no async, no DB access.
 */
export class VoiceMatcherService {
  // fuzzysort score threshold — lower is more permissive
  private static readonly SCORE_THRESHOLD = -5000;
  private static readonly LEADING_LOCATION_WORDS =
    /^(?:(?:the|a|an|my)\s+)?(?:(?:space|room|area|location|place|container|box|shelf|bin|drawer|cabinet|bag|basket|folder)\s+(?:is|called|named)\s+|(?:is|called|named)\s+)+/i;

  /**
   * Resolve parsed parts against the provided spaces and containers lists.
   *
   * @param parts      Output from VoiceParserService.parse()
   * @param spaces     All spaces from SpaceService.getAllSpaces()
   * @param containers Containers for the resolved space, or all containers if space not yet resolved
   */
  static resolve(
    parts: RawParsedParts,
    spaces: Space[],
    containers: Container[]
  ): ParsedVoiceCommand {
    const space = this.matchSpace(parts.spokenSpace, spaces);
    const container: ParsedVoiceCommand['container'] =
      parts.spokenContainer === null
        ? 'absent'
        : this.matchContainer(parts.spokenContainer, containers);

    return {
      raw: parts.raw,
      action: parts.action,
      itemName: parts.itemName,
      space,
      container,
    };
  }

  private static matchSpace(spoken: string | null, spaces: Space[]): MatchResult<Space> {
    if (!spoken) return { status: 'none', spoken: '' };

    const cleaned = this.cleanSpokenName(spoken);
    const exact = spaces.find(s => this.namesMatch(s.name, cleaned));
    if (exact) return { status: 'exact', record: exact };

    const results = fuzzysort.go(cleaned, spaces, {
      keys: ['name', (space) => this.normalizeName(space.name)],
      limit: 3,
      threshold: this.SCORE_THRESHOLD,
    });

    if (results.length === 0) return { status: 'none', spoken: cleaned };
    const candidates = results.map(r => r.obj);
    return { status: 'fuzzy', candidates, spoken: cleaned };
  }

  private static matchContainer(spoken: string, containers: Container[]): MatchResult<Container> {
    if (!spoken) return { status: 'none', spoken };

    const cleaned = this.cleanSpokenName(spoken);
    const exact = containers.find(c => this.namesMatch(c.name, cleaned));
    if (exact) return { status: 'exact', record: exact };

    const results = fuzzysort.go(cleaned, containers, {
      keys: ['name', (container) => this.normalizeName(container.name)],
      limit: 3,
      threshold: this.SCORE_THRESHOLD,
    });

    if (results.length === 0) return { status: 'none', spoken: cleaned };
    const candidates = results.map(r => r.obj);
    return { status: 'fuzzy', candidates, spoken: cleaned };
  }

  private static cleanSpokenName(value: string): string {
    return value
      .trim()
      .replace(/[.,!?]+$/g, '')
      .replace(/^(?:and|then)\s+/i, '')
      .replace(this.LEADING_LOCATION_WORDS, '')
      .replace(/^(?:the|a|an|my)\s+/i, '')
      .trim();
  }

  private static namesMatch(recordName: string, spokenName: string): boolean {
    return this.normalizeName(recordName) === this.normalizeName(spokenName);
  }

  private static normalizeName(value: string): string {
    return value
      .toLocaleLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '');
  }
}

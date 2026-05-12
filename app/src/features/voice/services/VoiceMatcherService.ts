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

    const exact = spaces.find(s => s.name.toLowerCase() === spoken.toLowerCase());
    if (exact) return { status: 'exact', record: exact };

    const results = fuzzysort.go(spoken, spaces, {
      key: 'name',
      limit: 3,
      threshold: this.SCORE_THRESHOLD,
    });

    if (results.length === 0) return { status: 'none', spoken };
    const candidates = results.map(r => r.obj);
    return { status: 'fuzzy', candidates, spoken };
  }

  private static matchContainer(spoken: string, containers: Container[]): MatchResult<Container> {
    if (!spoken) return { status: 'none', spoken };

    const exact = containers.find(c => c.name.toLowerCase() === spoken.toLowerCase());
    if (exact) return { status: 'exact', record: exact };

    const results = fuzzysort.go(spoken, containers, {
      key: 'name',
      limit: 3,
      threshold: this.SCORE_THRESHOLD,
    });

    if (results.length === 0) return { status: 'none', spoken };
    const candidates = results.map(r => r.obj);
    return { status: 'fuzzy', candidates, spoken };
  }
}

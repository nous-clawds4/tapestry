/**
 * GrapeRank / Web-of-Trust score fetcher — v1.1 hook.
 *
 * v1 ships this as a stub returning 1.0 for everyone. v1.1 will swap in
 * a real fetch against the user-configurable WoT endpoint stored in
 * Settings. The shape stays the same so swapping is a one-file change.
 */

export interface WotScorer {
  /** Get the GrapeRank score for a pubkey. Returns null when unknown. */
  scoreOf(pubkey: string): Promise<number | null>;
  /** Batch lookup. */
  scoresOf(pubkeys: string[]): Promise<Map<string, number>>;
}

class StubScorer implements WotScorer {
  async scoreOf(): Promise<number | null> {
    return 1;
  }
  async scoresOf(pubkeys: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    for (const pk of pubkeys) out.set(pk, 1);
    return out;
  }
}

let _scorer: WotScorer = new StubScorer();

export function getWotScorer(): WotScorer {
  return _scorer;
}

/** v1.1 hook — Settings page will call this with the configured endpoint. */
export function setWotScorer(scorer: WotScorer) {
  _scorer = scorer;
}

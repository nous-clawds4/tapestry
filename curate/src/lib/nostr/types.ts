/**
 * Domain types for Curate's view of Decentralized Lists.
 *
 * These are *not* the raw relay event shapes — they're the parsed,
 * normalized form rendered to UI. Parsers in ./parsers.ts produce these
 * from raw NostrEvents; builders in ./events.ts go the other way.
 */

import type { NostrEvent } from "nostr-tools/pure";

/** Field-type hints we render forms with. Curate-specific; lists from
 * other clients won't declare these, so the parser defaults to "text". */
export type FieldType =
  | "text"
  | "long-text"
  | "number"
  | "url"
  | "date"
  | "boolean";

export interface FieldSchema {
  /** The bare nostr tag name used on items, e.g. "title", "director". */
  name: string;
  /** Curate-side rendering hint. Defaults to "text" when absent. */
  type: FieldType;
  /** Required vs allowed vs recommended, per the DList NIP. */
  presence: "required" | "allowed" | "recommended";
  /** Human-readable description (third element on `required`/`allowed` tags). */
  description?: string;
}

export interface ListHeader {
  /** Stable identifier — `<kind>:<pubkey>:<d-tag>` for replaceable headers,
   * or the raw event id for kind 9998 unreplaceable headers. Used as the
   * `z` tag value on items. */
  uuid: string;
  /** Event kind: 9998 (unreplaceable) or 39998 (replaceable). */
  kind: 9998 | 39998;
  /** The `d` tag value for replaceable headers; null for kind 9998. */
  dTag: string | null;
  /** Hex pubkey of the list author. */
  author: string;
  /** Plural form of the list name — primary display. */
  namePlural: string;
  /** Singular form of the list name. */
  nameSingular: string;
  /** Optional human-readable title (separate from `names`). */
  titlePlural?: string;
  titleSingular?: string;
  /** Optional description. */
  description?: string;
  /** Category tags (from `topic` tags on the header). */
  topics: string[];
  /** Schema declarations from `required`/`allowed`/`recommended` tags. */
  schema: FieldSchema[];
  /** True when the header has zero schema declarations — we render items
   * with a "schema not declared" affordance and fall back to raw content. */
  schemaUnknown: boolean;
  /** Item kinds this list accepts (defaults to [9999, 39999] per NIP). */
  itemKinds: number[];
  /** Event created_at (seconds since epoch). */
  createdAt: number;
  /** Whether this header replaces an earlier version (we saw multiple
   * with same `<pubkey>:<d-tag>` and kept the latest). */
  edited: boolean;
  /** Raw event reference for downstream tools that need it. */
  raw: NostrEvent;
}

export interface ListItem {
  /** Stable identifier — `<kind>:<pubkey>:<d-tag>` for kind 39999, or
   * the raw event id for kind 9999. */
  uuid: string;
  kind: 9999 | 39999;
  dTag: string | null;
  author: string;
  /** UUIDs of the parent list(s) this item belongs to. */
  parentListUuids: string[];
  /** Field-name -> value, extracted from bare-named tags on the item. */
  fields: Record<string, string>;
  /** Optional `name`, `title`, `slug`, `description`, `comments`. */
  name?: string;
  title?: string;
  slug?: string;
  description?: string;
  comments?: string;
  /** Standard item-tag payloads (`p`, `e`, `t`, `a`) — kept separately
   * because they have NIP-level semantics. */
  pubkeys: string[];
  eventIds: string[];
  topics: string[];
  addresses: string[];
  createdAt: number;
  edited: boolean;
  raw: NostrEvent;
}

export interface ReactionCount {
  /** Item UUID. */
  itemUuid: string;
  up: number;
  down: number;
  /** Whether the current signed-in user has reacted, if known. */
  mine?: "+" | "-" | null;
}

export type ReactionType = "+" | "-";

/** UI sort options on the Discover page. */
export type DiscoverSort =
  | "most-active-30d"
  | "most-items"
  | "newest"
  | "top-rated";

/** UI sort options inside a list. */
export type ItemSort = "top" | "newest" | "controversial";

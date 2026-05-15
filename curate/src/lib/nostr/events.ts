/**
 * Event builders — produce raw-tag-shape event templates conforming
 * to the Decentralized Lists NIP (DECENTRALIZED_LISTS.md) and NIP-25.
 *
 * Three rules we follow strictly:
 *   1. `content` is left empty (per Tapestry convention; structured data
 *      goes in tags, not content).
 *   2. Header `names` is REQUIRED and two-valued (singular, plural).
 *   3. Item `z` tag uses `39998:<pubkey>:<d-tag>` for replaceable parents,
 *      or the raw event id for kind 9998 parents.
 *
 * Curate-specific extensions are additive:
 *   - `["field-type", "<name>", "<type>"]` on the header carries our
 *     UI rendering hint. Base-only readers ignore it.
 *   - `["topic", "<category>"]` on the header carries category tags
 *     (precedent: COMMUNITY_RECORDS_DLIST.md).
 */

import type { EventTemplate } from "nostr-tools/pure";
import type { FieldSchema, FieldType } from "./types";

const KIND_LIST_HEADER = 39998;
const KIND_LIST_ITEM = 39999;
const KIND_REACTION = 7;

export interface CreateListHeaderInput {
  namePlural: string;
  nameSingular: string;
  titlePlural?: string;
  titleSingular?: string;
  description?: string;
  topics?: string[];
  schema: FieldSchema[];
  /** Optional override; defaults to kebab-case of `namePlural`. */
  dTag?: string;
  /** Foreign item kinds to accept (Method 3 from COMPAT NIP). */
  itemKinds?: number[];
}

/** Build an unsigned event template — caller signs via the signer. */
export function buildListHeaderEvent(input: CreateListHeaderInput): EventTemplate {
  const tags: string[][] = [];

  const dTag = input.dTag ?? toSlug(input.namePlural);
  tags.push(["d", dTag]);

  // names is REQUIRED and two-valued
  tags.push(["names", input.nameSingular.trim(), input.namePlural.trim()]);

  if (input.titlePlural || input.titleSingular) {
    tags.push([
      "titles",
      (input.titleSingular ?? input.nameSingular).trim(),
      (input.titlePlural ?? input.namePlural).trim(),
    ]);
  }

  if (input.description) {
    tags.push(["description", input.description.trim()]);
  }

  for (const topic of input.topics ?? []) {
    const t = topic.trim();
    if (t) tags.push(["topic", t]);
  }

  // Schema declarations — required/allowed/recommended tags with optional
  // human description as the third element.
  for (const field of input.schema) {
    const tag: string[] = [field.presence, field.name];
    if (field.description) tag.push(field.description);
    tags.push(tag);

    // Curate-specific rendering hint (additive, ignorable).
    tags.push(["field-type", field.name, field.type]);
  }

  // item-kind tags (omit when defaulting to 9999/39999).
  for (const kind of input.itemKinds ?? []) {
    tags.push(["item-kind", String(kind)]);
  }

  return {
    kind: KIND_LIST_HEADER,
    content: "",
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

export interface AddListItemInput {
  /** Parent list's stable identifier: `39998:<pubkey>:<d-tag>`. */
  parentListUuid: string;
  /** Tag-name -> value map. Keys correspond to FieldSchema.name. */
  fields: Record<string, string>;
  /** Reserved item-meta values, per the NIP. */
  name?: string;
  title?: string;
  slug?: string;
  description?: string;
  comments?: string;
  /** d-tag for replaceable identity. Auto-generated if omitted. */
  dTag?: string;
  /** Standard item tags by their NIP-level meaning. */
  pubkeys?: string[];
  eventIds?: string[];
  topics?: string[];
  addresses?: string[];
}

export function buildListItemEvent(input: AddListItemInput): EventTemplate {
  const tags: string[][] = [];

  // d-tag for replaceable identity. We hash (parent + first field value)
  // for stability, so re-publishing the "same" item replaces in place.
  const dTag = input.dTag ?? deriveItemDTag(input);
  tags.push(["d", dTag]);

  tags.push(["z", input.parentListUuid]);

  // Standard item-tag payloads
  for (const p of input.pubkeys ?? []) tags.push(["p", p]);
  for (const e of input.eventIds ?? []) tags.push(["e", e]);
  for (const t of input.topics ?? []) tags.push(["t", t]);
  for (const a of input.addresses ?? []) tags.push(["a", a]);

  // Reserved meta tags
  if (input.name) tags.push(["name", input.name.trim()]);
  if (input.title) tags.push(["title", input.title.trim()]);
  if (input.slug) tags.push(["slug", input.slug.trim()]);
  if (input.description) tags.push(["description", input.description.trim()]);
  if (input.comments) tags.push(["comments", input.comments.trim()]);

  // Custom field-value tags as bare-named tags
  for (const [name, value] of Object.entries(input.fields)) {
    if (!value && value !== "0") continue;
    if (RESERVED_ITEM_TAG_NAMES.has(name)) continue; // already handled above
    tags.push([name, value]);
  }

  return {
    kind: KIND_LIST_ITEM,
    content: "",
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

export interface BuildReactionInput {
  /** Item event id we're reacting to. */
  itemEventId: string;
  /** Item's `<kind>:<pubkey>:<d-tag>` address — for replaceable-target stability. */
  itemAddress?: string;
  /** Item author pubkey — recommended per NIP-25. */
  itemAuthor?: string;
  /** Target event kind, as a string. */
  itemKind?: number;
  /** Parent list address, so subscribers can filter all reactions on a list. */
  parentListUuid?: string;
  /** "+" or "-". */
  reaction: "+" | "-";
}

export function buildReactionEvent(input: BuildReactionInput): EventTemplate {
  const tags: string[][] = [["e", input.itemEventId]];
  if (input.itemAuthor) tags.push(["p", input.itemAuthor]);
  if (input.itemAddress) tags.push(["a", input.itemAddress]);
  if (input.itemKind) tags.push(["k", String(input.itemKind)]);
  if (input.parentListUuid) tags.push(["a", input.parentListUuid]);

  return {
    kind: KIND_REACTION,
    content: input.reaction,
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

/** Compute the stable `<kind>:<pubkey>:<d-tag>` UUID for a replaceable header. */
export function listHeaderUuid(pubkey: string, dTag: string): string {
  return `39998:${pubkey}:${dTag}`;
}

/** Compute the stable UUID for a replaceable item. */
export function listItemUuid(pubkey: string, dTag: string): string {
  return `39999:${pubkey}:${dTag}`;
}

// -- internal helpers -----------------------------------------------------

const RESERVED_ITEM_TAG_NAMES = new Set([
  "d",
  "z",
  "p",
  "e",
  "t",
  "a",
  "k",
  "name",
  "title",
  "slug",
  "description",
  "comments",
  "field-type",
]);

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function deriveItemDTag(input: AddListItemInput): string {
  const primary =
    input.name ??
    input.title ??
    Object.values(input.fields).find((v) => !!v) ??
    "";
  const slug = toSlug(primary) || "item";
  // Short hash of (parent + slug) so different primaries don't collide
  // across the same parent list.
  return `${slug}-${hashShort(input.parentListUuid + ":" + slug)}`;
}

function hashShort(input: string): string {
  // Lightweight non-crypto hash; sufficient for d-tag stability.
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36).slice(0, 8);
}

export type FieldTypeMap = Record<string, FieldType>;

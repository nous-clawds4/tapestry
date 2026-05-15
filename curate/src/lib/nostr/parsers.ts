/**
 * Tolerant parsers — convert raw NostrEvent payloads into the normalized
 * domain types Curate renders.
 *
 * Tolerance is the point: many DList headers already on relays predate
 * Curate and may use idiosyncratic tag conventions. We pull display data
 * from the most-likely tags and fall back gracefully when a field is
 * missing. Anything we can't make sense of becomes `schemaUnknown: true`,
 * which the UI surfaces with a small "schema not declared" affordance.
 */

import type { NostrEvent } from "nostr-tools/pure";
import type {
  FieldSchema,
  FieldType,
  ListHeader,
  ListItem,
} from "./types";

const VALID_FIELD_TYPES = new Set<FieldType>([
  "text",
  "long-text",
  "number",
  "url",
  "date",
  "boolean",
]);

const PRESENCE_TAGS = new Set([
  "required",
  "allowed",
  "recommended",
  "optional",
  "disallowed",
]);

const RESERVED_ITEM_TAGS = new Set([
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

const HEADER_NON_FIELD_TAGS = new Set([
  "d",
  "name",
  "names",
  "title",
  "titles",
  "slugs",
  "slug",
  "description",
  "topic",
  "field-type",
  "item-kind",
  "image",
  "alt",
  "json",
  ...PRESENCE_TAGS,
]);

/** Parse a single raw NostrEvent into a ListHeader, or null if it
 * doesn't look like a 9998/39998 event we can render. */
export function parseListHeader(event: NostrEvent): ListHeader | null {
  if (event.kind !== 9998 && event.kind !== 39998) return null;

  const tags = event.tags ?? [];
  const dTag = firstTagValue(tags, "d");

  if (event.kind === 39998 && !dTag) {
    // Replaceable headers without a d-tag are technically invalid per
    // NIP-01; skip rather than guess.
    return null;
  }

  const namesTag = firstTag(tags, "names");
  const titlesTag = firstTag(tags, "titles");
  const slugsTag = firstTag(tags, "slugs");
  // Tolerate singular "name" / "title" tags from non-conforming clients
  const singleNameTag = firstTagValue(tags, "name");
  const singleTitleTag = firstTagValue(tags, "title");

  // names tag: ["names", singular, plural]
  let nameSingular = namesTag?.[1] ?? "";
  let namePlural = namesTag?.[2] ?? namesTag?.[1] ?? "";

  // Fallbacks for headers that don't carry the `names` tag
  if (!namePlural) {
    namePlural =
      singleNameTag ??
      singleTitleTag ??
      titlesTag?.[2] ??
      titlesTag?.[1] ??
      slugsTag?.[2] ??
      slugsTag?.[1] ??
      dTag ??
      "Untitled list";
    nameSingular = singleNameTag ?? singleTitleTag ?? namePlural;
  }

  const titlePlural = titlesTag?.[2] ?? titlesTag?.[1];
  const titleSingular = titlesTag?.[1];

  const description = firstTagValue(tags, "description") ?? undefined;
  const topics = allTagValues(tags, "topic");

  // Field-type hints (Curate-specific). Map of name -> type.
  const fieldTypes = new Map<string, FieldType>();
  for (const tag of tags) {
    if (tag[0] !== "field-type" || !tag[1]) continue;
    const candidate = tag[2] as FieldType | undefined;
    if (candidate && VALID_FIELD_TYPES.has(candidate)) {
      fieldTypes.set(tag[1], candidate);
    }
  }

  // Schema declarations
  const schema: FieldSchema[] = [];
  for (const tag of tags) {
    const presence = tag[0];
    if (!PRESENCE_TAGS.has(presence)) continue;
    if (presence === "disallowed") continue; // not surfaced in v1
    const name = tag[1];
    if (!name) continue;
    // Normalize "optional" → "allowed" for consistency
    const normalizedPresence =
      presence === "optional" ? "allowed" : presence;
    schema.push({
      name,
      type: fieldTypes.get(name) ?? "text",
      presence: normalizedPresence as FieldSchema["presence"],
      description: tag[2],
    });
  }

  // item-kind tags
  const itemKinds = allTagValues(tags, "item-kind")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));

  const uuid =
    event.kind === 39998
      ? `39998:${event.pubkey}:${dTag}`
      : event.id;

  return {
    uuid,
    kind: event.kind as 9998 | 39998,
    dTag: dTag ?? null,
    author: event.pubkey,
    namePlural,
    nameSingular,
    titlePlural,
    titleSingular,
    description,
    topics,
    schema,
    schemaUnknown: schema.length === 0,
    itemKinds: itemKinds.length ? itemKinds : [9999, 39999],
    createdAt: event.created_at ?? 0,
    edited: false,
    raw: event,
  };
}

/** Parse a single raw NostrEvent into a ListItem. */
export function parseListItem(event: NostrEvent): ListItem | null {
  if (event.kind !== 9999 && event.kind !== 39999) return null;

  const tags = event.tags ?? [];
  const dTag = firstTagValue(tags, "d");

  if (event.kind === 39999 && !dTag) return null;

  const zTags = allTagValues(tags, "z");
  if (zTags.length === 0) return null; // an item without a z tag is orphaned

  // Walk all tags, splitting reserved-vs-custom
  const fields: Record<string, string> = {};
  for (const tag of tags) {
    const [name, value] = tag;
    if (!name || value === undefined) continue;
    if (RESERVED_ITEM_TAGS.has(name)) continue;
    fields[name] = value;
  }

  const uuid =
    event.kind === 39999
      ? `39999:${event.pubkey}:${dTag}`
      : event.id;

  return {
    uuid,
    kind: event.kind as 9999 | 39999,
    dTag: dTag ?? null,
    author: event.pubkey,
    parentListUuids: zTags,
    fields,
    name: firstTagValue(tags, "name"),
    title: firstTagValue(tags, "title"),
    slug: firstTagValue(tags, "slug"),
    description: firstTagValue(tags, "description"),
    comments: firstTagValue(tags, "comments"),
    pubkeys: allTagValues(tags, "p"),
    eventIds: allTagValues(tags, "e"),
    topics: allTagValues(tags, "t"),
    addresses: allTagValues(tags, "a"),
    createdAt: event.created_at ?? 0,
    edited: false,
    raw: event,
  };
}

/** Dedupe a stream of headers by (kind, pubkey, dTag) keeping the latest
 * by created_at, and flag any replaced ones as `edited: true`. */
export function dedupeHeaders(headers: ListHeader[]): ListHeader[] {
  const byUuid = new Map<string, ListHeader>();
  const seenMultiple = new Set<string>();
  for (const h of headers) {
    const existing = byUuid.get(h.uuid);
    if (!existing) {
      byUuid.set(h.uuid, h);
    } else {
      seenMultiple.add(h.uuid);
      if (h.createdAt > existing.createdAt) byUuid.set(h.uuid, h);
    }
  }
  for (const uuid of seenMultiple) {
    const h = byUuid.get(uuid);
    if (h) byUuid.set(uuid, { ...h, edited: true });
  }
  return Array.from(byUuid.values());
}

export function dedupeItems(items: ListItem[]): ListItem[] {
  const byUuid = new Map<string, ListItem>();
  const seenMultiple = new Set<string>();
  for (const it of items) {
    const existing = byUuid.get(it.uuid);
    if (!existing) {
      byUuid.set(it.uuid, it);
    } else {
      seenMultiple.add(it.uuid);
      if (it.createdAt > existing.createdAt) byUuid.set(it.uuid, it);
    }
  }
  for (const uuid of seenMultiple) {
    const it = byUuid.get(uuid);
    if (it) byUuid.set(uuid, { ...it, edited: true });
  }
  return Array.from(byUuid.values());
}

// -- internal helpers -----------------------------------------------------

function firstTag(tags: string[][], name: string): string[] | undefined {
  return tags.find((t) => t[0] === name);
}

function firstTagValue(tags: string[][], name: string): string | undefined {
  return firstTag(tags, name)?.[1];
}

function allTagValues(tags: string[][], name: string): string[] {
  const out: string[] = [];
  for (const t of tags) if (t[0] === name && t[1]) out.push(t[1]);
  return out;
}

/** Public re-export so non-NIP tag-name lookups have one canonical place. */
export function isHeaderFieldTagName(name: string): boolean {
  return !HEADER_NON_FIELD_TAGS.has(name);
}

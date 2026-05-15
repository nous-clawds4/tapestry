"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ensurePool } from "@/lib/nostr/ndk";
import {
  parseListHeader,
  parseListItem,
  dedupeItems,
} from "@/lib/nostr/parsers";
import { streamListItems, type StreamingHandle } from "@/lib/nostr/subscriptions";
import { AddItemForm } from "@/components/add-item-form";
import { EditHeaderForm } from "@/components/edit-header-form";
import { EditItemForm } from "@/components/edit-item-form";
import { ReactionButtons } from "@/components/reaction-buttons";
import { UserIdentity } from "@/components/user-identity";
import type { ListHeader, ListItem } from "@/lib/nostr/types";
import type { NostrEvent } from "nostr-tools/pure";
import type { Subscription } from "rxjs";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import { useSigner } from "@/stores/signer";

const PAGE_SIZE = 100;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function ListDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const decodedSlug = decodeURIComponent(slug);
  const signerStatus = useSigner((s) => s.status);

  const [header, setHeader] = useState<ListHeader | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [headerNotFound, setHeaderNotFound] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditHeader, setShowEditHeader] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const pubkey = useSigner((s) => s.pubkey);
  const isAuthor = !!(pubkey && header && pubkey === header.author);

  // Fetch the header
  useEffect(() => {
    let cancelled = false;
    const subs: Subscription[] = [];

    const { pool, relays } = ensurePool();
    const isAddress =
      decodedSlug.startsWith("39998:") || decodedSlug.startsWith("9998:");

    if (isAddress) {
      const parts = decodedSlug.split(":");
      const kind = Number(parts[0]);
      const pubkey = parts[1];
      const dTag = parts.slice(2).join(":");

      const filters: Record<string, unknown> = {
        kinds: [kind],
        authors: [pubkey],
      };
      if (dTag) filters["#d"] = [dTag];

      // Use request() for fast load — completes on EOSE
      const sub = pool
        .request(
          relays,
          filters as { kinds: number[]; authors: string[]; "#d"?: string[] }
        )
        .subscribe({
          next(evt: NostrEvent) {
            if (cancelled) return;
            const parsed = parseListHeader(evt);
            if (parsed && parsed.uuid === decodedSlug) {
              setHeader((prev) =>
                !prev || parsed.createdAt > prev.createdAt ? parsed : prev
              );
            }
          },
          error() {
            if (!cancelled) setHeaderNotFound(true);
          },
          complete() {
            if (cancelled) return;
            setHeader((prev) => {
              if (!prev) setHeaderNotFound(true);
              return prev;
            });
          },
        });
      subs.push(sub);
    } else {
      // Raw event ID
      const sub = pool
        .request(relays, { ids: [decodedSlug] })
        .subscribe({
          next(evt: NostrEvent) {
            if (cancelled) return;
            const parsed = parseListHeader(evt);
            if (parsed) setHeader(parsed);
          },
          complete() {
            if (cancelled) return;
            setHeader((prev) => {
              if (!prev) setHeaderNotFound(true);
              return prev;
            });
          },
        });
      subs.push(sub);
    }

    return () => {
      cancelled = true;
      for (const s of subs) s.unsubscribe();
    };
  }, [decodedSlug]);

  // Fetch items — uses request() + subscription() via streamListItems
  useEffect(() => {
    const handle = streamListItems([decodedSlug], {
      onUpdate: (its) => setItems(its),
      onEose: () => setLoading(false),
    });

    return () => handle.stop();
  }, [decodedSlug]);

  // Optimistic header update
  const handleHeaderUpdated = useCallback(
    (updated: ListHeader) => {
      setHeader(updated);
      setShowEditHeader(false);
    },
    []
  );

  // Optimistic item update (edit)
  const handleItemUpdated = useCallback(
    (updated: ListItem) => {
      setItems((prev) => {
        const map = new Map<string, ListItem>();
        for (const it of prev) map.set(it.uuid, it);
        map.set(updated.uuid, updated);
        return Array.from(map.values());
      });
    },
    []
  );

  // Optimistic add: insert a new item into local state immediately
  const handleItemPublished = useCallback(
    (newItem: ListItem) => {
      setItems((prev) => {
        const map = new Map<string, ListItem>();
        for (const it of prev) map.set(it.uuid, it);
        map.set(newItem.uuid, newItem);
        return Array.from(map.values());
      });
      setShowAddForm(false);
    },
    []
  );

  const allItems = useMemo(
    () => dedupeItems(items).sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => {
      const hay = [
        item.name ?? "",
        item.title ?? "",
        item.description ?? "",
        ...Object.values(item.fields),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allItems, searchQuery]);

  const paginatedItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  );

  // Reset pagination when search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery]);

  if (headerNotFound && !header) {
    return (
      <div className="mx-auto max-w-[1100px] px-8 py-12">
        <Link
          href="/"
          className="text-[13px] text-mute hover:text-ink-soft transition-colors"
        >
          &larr; Back to Discover
        </Link>
        <div className="mt-16 text-center">
          <p className="font-serif text-[20px] text-ink-soft italic">
            List not found.
          </p>
          <p className="mt-3 text-[13px] text-mute">
            This list may have been deleted or the relay didn&apos;t respond.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-8 py-12">
      <Link
        href="/"
        className="text-[13px] text-mute hover:text-ink-soft transition-colors"
      >
        &larr; Back to Discover
      </Link>

      {!header && !headerNotFound ? (
        <div className="mt-8">
          <div
            className="h-10 w-64 bg-rule/50 animate-pulse"
            style={{ borderRadius: "var(--radius-input)" }}
          />
          <div
            className="mt-4 h-5 w-96 bg-rule/30 animate-pulse"
            style={{ borderRadius: "var(--radius-input)" }}
          />
        </div>
      ) : header ? (
        <>
          <header className="mt-8">
            <h1 className="font-serif text-[36px] leading-[1.1] tracking-[-0.015em] text-ink font-light">
              {capitalize(header.namePlural)}
            </h1>
            {header.description ? (
              <p className="mt-3 font-serif text-[16px] leading-[1.5] text-ink-soft italic">
                {header.description}
              </p>
            ) : null}

            <div className="mt-4 flex items-center gap-3 text-[12px] text-mute">
              <span className="inline-flex items-center gap-1">
                by <UserIdentity pubkey={header.author} avatarSize={18} textClass="text-[12px]" />
              </span>
              <span aria-hidden className="text-rule-strong">
                &middot;
              </span>
              <span>{formatRelativeTime(header.createdAt)}</span>
              {header.edited ? (
                <>
                  <span aria-hidden className="text-rule-strong">
                    &middot;
                  </span>
                  <span className="text-accent text-[11px]">edited</span>
                </>
              ) : null}
            </div>

            {header.topics.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {header.topics.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] uppercase tracking-[0.1em] text-mute border border-rule px-2 py-0.5"
                    style={{ borderRadius: "var(--radius-input)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}

            {header.schema.length > 0 ? (
              <div className="mt-4 text-[12px] text-mute/60">
                Tracks {header.schema.map((f) => f.name).join(", ")}
              </div>
            ) : null}

            {isAuthor && !showEditHeader ? (
              <button
                type="button"
                onClick={() => setShowEditHeader(true)}
                className="mt-4 text-[12px] text-mute hover:text-accent transition-colors"
              >
                Edit list details
              </button>
            ) : null}
          </header>

          {showEditHeader && header ? (
            <div
              className="mt-6 border border-accent/20 bg-surface p-5"
              style={{ borderRadius: "var(--radius-card)" }}
            >
              <EditHeaderForm
                header={header}
                onUpdated={handleHeaderUpdated}
                onCancel={() => setShowEditHeader(false)}
              />
            </div>
          ) : null}

          {/* Items section */}
          <div className="mt-10 border-t border-rule pt-8">
            <div className="mb-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-[12px] text-mute">
                  {filteredItems.length !== allItems.length ? (
                    <>
                      {filteredItems.length} of{" "}
                      {allItems.length.toLocaleString()}{" "}
                      {allItems.length === 1 ? "item" : "items"}
                    </>
                  ) : (
                    <>
                      {filteredItems.length.toLocaleString()}{" "}
                      {filteredItems.length === 1 ? "item" : "items"}
                    </>
                  )}
                  {loading ? (
                    <span className="ml-2 text-accent/60">loading...</span>
                  ) : null}
                </div>

                {!showAddForm ? (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="text-[12px] font-medium px-4 py-1.5 bg-accent text-ink hover:brightness-110 transition-all"
                    style={{ borderRadius: "var(--radius-input)" }}
                  >
                    + Add {header.nameSingular}
                  </button>
                ) : null}
              </div>

              {/* Search within list */}
              {allItems.length > 5 || searchQuery ? (
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${header.namePlural.toLowerCase()}...`}
                  className={cn(
                    "w-full md:max-w-sm bg-surface text-ink placeholder:text-mute/60",
                    "border border-rule px-3.5 py-2 text-[14px] outline-none",
                    "focus:border-rule-strong focus:bg-surface-hover transition-all duration-200"
                  )}
                  style={{ borderRadius: "var(--radius-input)" }}
                />
              ) : null}
            </div>

            {showAddForm ? (
              <div
                className="mb-6 border border-accent/20 bg-surface p-5"
                style={{ borderRadius: "var(--radius-card)" }}
              >
                <AddItemForm
                  header={header}
                  onPublished={handleItemPublished}
                  onCancel={() => setShowAddForm(false)}
                />
              </div>
            ) : null}

            {filteredItems.length === 0 && !loading ? (
              <div className="py-12 text-center">
                <p className="font-serif text-[18px] text-ink-soft italic">
                  {searchQuery
                    ? "No items match your search."
                    : "No items yet."}
                </p>
                <p className="mt-2 text-[13px] text-mute">
                  {searchQuery
                    ? "Try a different search term."
                    : "Be the first to add something to this list."}
                </p>
              </div>
            ) : (
              <>
                {/* Pagination status */}
                {filteredItems.length > PAGE_SIZE ? (
                  <div className="mb-3 text-[12px] text-mute">
                    Showing 1 to{" "}
                    {Math.min(visibleCount, filteredItems.length).toLocaleString()}{" "}
                    of {filteredItems.length.toLocaleString()}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3">
                  {paginatedItems.map((item) => (
                    <ItemRow
                      key={item.uuid}
                      item={item}
                      header={header}
                      currentPubkey={pubkey}
                      onItemUpdated={handleItemUpdated}
                    />
                  ))}
                </div>

                {/* Show more button */}
                {visibleCount < filteredItems.length ? (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleCount((c) => c + PAGE_SIZE)
                      }
                      className="text-[13px] font-medium px-6 py-2 border border-rule text-ink-soft hover:text-ink hover:border-rule-strong bg-surface transition-all duration-150"
                      style={{ borderRadius: "var(--radius-input)" }}
                    >
                      Show more ({Math.min(
                        PAGE_SIZE,
                        filteredItems.length - visibleCount
                      ).toLocaleString()}{" "}
                      remaining)
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ItemRow({
  item,
  header,
  currentPubkey,
  onItemUpdated,
}: {
  item: ListItem;
  header: ListHeader;
  currentPubkey: string | null;
  onItemUpdated: (updated: ListItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isOwner = !!(currentPubkey && currentPubkey === item.author);

  const displayName =
    item.name ??
    item.title ??
    item.fields[header.schema[0]?.name] ??
    Object.values(item.fields)[0] ??
    "Unnamed item";

  const secondaryFields = Object.entries(item.fields).filter(
    ([key, val]) => val && key !== header.schema[0]?.name
  );

  const itemAddress =
    item.kind === 39999 && item.dTag
      ? `39999:${item.author}:${item.dTag}`
      : undefined;

  if (editing) {
    return (
      <div
        className="border border-accent/20 bg-surface px-5 py-4"
        style={{ borderRadius: "var(--radius-card)" }}
      >
        <EditItemForm
          header={header}
          item={item}
          onUpdated={(updated) => {
            onItemUpdated(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div
      className="group border border-rule bg-surface px-5 py-4 transition-all duration-150 hover:border-rule-strong hover:bg-surface-hover"
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[18px] leading-[1.3] text-ink">
            {displayName}
          </p>
          {item.description ? (
            <p className="mt-1 text-[13px] leading-[1.5] text-ink-soft italic line-clamp-2">
              {item.description}
            </p>
          ) : null}
          {secondaryFields.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-mute">
              {secondaryFields.slice(0, 5).map(([key, val]) => (
                <span key={key}>
                  <span className="text-mute/50">{key}</span> {val}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <div className="text-[11px] text-mute text-right">
            <UserIdentity
              pubkey={item.author}
              avatarSize={16}
              textClass="text-[10px]"
            />
            <div className="mt-0.5">{formatRelativeTime(item.createdAt)}</div>
            {item.edited ? (
              <div className="text-accent text-[10px]">edited</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-[11px] text-mute hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
              >
                Edit
              </button>
            ) : null}
            <ReactionButtons
              itemEventId={item.raw.id}
              itemAddress={itemAddress}
              itemAuthor={item.author}
              itemKind={item.kind}
              parentListUuid={header.uuid}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// -- helpers ---------------------------------------------------------------

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

"use client";

import { useMemo, useState } from "react";
import { ListCard } from "@/components/list-card";
import { useDiscover } from "@/hooks/use-discover";
import { useItemCounts } from "@/hooks/use-item-counts";
import { cn } from "@/lib/utils";
import type { DiscoverSort } from "@/lib/nostr/types";

const SORT_OPTIONS: { value: DiscoverSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "most-active-30d", label: "A-Z" },
];

/** Returns true if the header has a real human-assigned name (not a fallback). */
function isTitled(h: { namePlural: string }): boolean {
  const n = h.namePlural.trim().toLowerCase();
  if (n === "untitled list" || n === "") return false;
  // Pure hex IDs (event ids or d-tags used as names)
  if (/^[0-9a-f]{8,}$/.test(n)) return false;
  // Nostr addresses used as names (e.g. "39998:abc123:foo")
  if (/^\d+:[0-9a-f]+:/.test(n)) return false;
  return true;
}

export default function DiscoverPage() {
  const { headers, loading } = useDiscover();
  const { counts: itemCounts } = useItemCounts();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [sort, setSort] = useState<DiscoverSort>("newest");
  const [showUntitled, setShowUntitled] = useState(false);

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of headers) {
      for (const t of h.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  }, [headers]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = headers;

    // Filter untitled lists unless toggle is on
    if (!showUntitled) {
      filtered = filtered.filter(isTitled);
    }

    if (q) {
      filtered = filtered.filter((h) => {
        const hay = [
          h.namePlural,
          h.nameSingular,
          h.titlePlural ?? "",
          h.titleSingular ?? "",
          h.description ?? "",
          ...h.topics,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (topic) {
      filtered = filtered.filter((h) => h.topics.includes(topic));
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "most-active-30d":
          // A-Z by name
          return a.namePlural.localeCompare(b.namePlural);
        case "newest":
        default:
          return b.createdAt - a.createdAt;
      }
    });

    return sorted;
  }, [headers, query, topic, sort, showUntitled]);

  return (
    <div className="mx-auto max-w-[1100px] px-8 py-12 md:py-16">
      {/* Hero */}
      <header className="max-w-2xl">
        <h1 className="font-serif text-[40px] leading-[1.08] tracking-[-0.02em] text-ink font-light">
          Lists, curated{" "}
          <span className="italic text-accent font-normal">together</span>.
        </h1>
        <p className="mt-4 text-[15px] leading-[1.6] text-ink-soft">
          Browse what people are collecting. Add to a list, build your own,
          signed to nostr and yours to take anywhere.
        </p>
      </header>

      {/* Search + Sort bar */}
      <div className="mt-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lists..."
            className={cn(
              "w-full bg-surface text-ink placeholder:text-mute/60",
              "border border-rule px-3.5 py-2 text-[14px] outline-none",
              "focus:border-rule-strong focus:bg-surface-hover transition-all duration-200"
            )}
            style={{ borderRadius: "var(--radius-input)" }}
          />
        </div>

        <div className="flex items-center gap-4">
          {/* Untitled toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-[12px] text-mute">Show untitled</span>
            <button
              type="button"
              role="switch"
              aria-checked={showUntitled}
              onClick={() => setShowUntitled((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200",
                showUntitled
                  ? "bg-accent border-accent/60"
                  : "bg-rule border-rule-strong"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-3.5 w-3.5 rounded-full bg-ink shadow-sm transition-transform duration-200",
                  showUntitled ? "translate-x-[18px]" : "translate-x-[2px]"
                )}
              />
            </button>
          </label>

          {/* Sort buttons */}
          <div
            className="flex items-center gap-0.5 text-[12px] bg-surface border border-rule p-0.5"
            style={{ borderRadius: "var(--radius-input)" }}
          >
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSort(opt.value)}
                className={cn(
                  "px-3 py-1.5 transition-all duration-150",
                  sort === opt.value
                    ? "text-ink bg-surface-raised"
                    : "text-mute hover:text-ink-soft"
                )}
                style={{ borderRadius: "calc(var(--radius-input) - 2px)" }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Topic filter chips */}
      {topics.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTopic(null)}
            className={cn(
              "text-[10px] uppercase tracking-[0.1em] px-2.5 py-1 border transition-all duration-150",
              topic === null
                ? "border-accent/40 text-accent bg-accent-glow"
                : "border-rule text-mute hover:text-ink-soft hover:border-rule-strong"
            )}
            style={{ borderRadius: "var(--radius-input)" }}
          >
            All
          </button>
          {topics.slice(0, 20).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t === topic ? null : t)}
              className={cn(
                "text-[10px] uppercase tracking-[0.1em] px-2.5 py-1 border transition-all duration-150",
                topic === t
                  ? "border-accent/40 text-accent bg-accent-glow"
                  : "border-rule text-mute hover:text-ink-soft hover:border-rule-strong"
              )}
              style={{ borderRadius: "var(--radius-input)" }}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {/* List grid */}
      <div className="mt-10 border-t border-rule pt-8">
        {loading && headers.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border border-rule bg-surface px-6 py-5 h-[160px] animate-pulse"
                style={{
                  borderRadius: "var(--radius-card)",
                  opacity: 0.3 + (i % 3) * 0.15,
                }}
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-serif text-[22px] text-ink-soft italic">
              {headers.length === 0
                ? "No lists found yet."
                : "Nothing matches that filter."}
            </p>
            <p className="mt-3 text-[13px] text-mute">
              {headers.length === 0
                ? "Try widening your relay set in Settings, or be the first to publish a list."
                : "Try clearing the search or category filter."}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <div className="text-[12px] text-mute">
                {visible.length === headers.length
                  ? `${headers.length} ${headers.length === 1 ? "list" : "lists"}`
                  : `${visible.length} of ${headers.length}`}
                {loading ? (
                  <span className="ml-2 text-accent/60">loading more...</span>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visible.map((h) => (
                <ListCard
                  key={h.uuid}
                  header={h}
                  itemCount={itemCounts.get(h.uuid) ?? 0}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

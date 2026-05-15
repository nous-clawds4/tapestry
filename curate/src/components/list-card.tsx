"use client";

import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";
import { UserIdentity } from "@/components/user-identity";
import type { ListHeader } from "@/lib/nostr/types";

interface Props {
  header: ListHeader;
  /** Number of items in this list (undefined = still loading). */
  itemCount?: number;
}

export function ListCard({ header, itemCount }: Props) {
  const slug = encodeURIComponent(header.uuid);

  return (
    <Link
      href={`/list/${slug}`}
      className="group relative block border border-rule bg-surface px-6 py-5 transition-all duration-200 hover:border-rule-strong hover:bg-surface-hover"
      style={{ borderRadius: "var(--radius-card)" }}
    >
      {/* Warm accent glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          borderRadius: "var(--radius-card)",
          background: "linear-gradient(135deg, var(--accent-glow) 0%, transparent 60%)",
        }}
      />

      <div className="relative flex flex-col gap-1.5">
        <h2 className="font-serif text-[24px] leading-[1.15] tracking-[-0.01em] text-ink">
          {capitalize(header.namePlural)}
        </h2>

        {header.description ? (
          <p className="font-serif text-[14px] leading-[1.55] text-ink-soft line-clamp-2 italic">
            {header.description}
          </p>
        ) : null}
      </div>

      {header.topics.length > 0 ? (
        <div className="relative mt-4 flex flex-wrap gap-1.5">
          {header.topics.slice(0, 4).map((t) => (
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

      <div className="relative mt-4 flex items-center justify-between gap-4 text-[11px] text-mute">
        <div className="flex items-center gap-2.5">
          <span>{formatRelativeTime(header.createdAt)}</span>
          <span aria-hidden className="text-rule-strong">&middot;</span>
          <span>
            {itemCount === undefined
              ? "…"
              : `${itemCount.toLocaleString()} ${itemCount === 1 ? "item" : "items"}`}
          </span>
        </div>
        <UserIdentity
          pubkey={header.author}
          avatarSize={16}
          textClass="text-[10px]"
        />
      </div>

    </Link>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buildReactionEvent } from "@/lib/nostr/events";
import { signAndPublish } from "@/lib/nostr/publish";
import { ensurePool } from "@/lib/nostr/ndk";
import { useSigner } from "@/stores/signer";
import { useToast } from "@/components/toast";
import type { NostrEvent } from "nostr-tools/pure";
import type { Subscription } from "rxjs";

interface Props {
  /** The item event id to react to. */
  itemEventId: string;
  /** The item's replaceable address, if any. */
  itemAddress?: string;
  /** The item author pubkey. */
  itemAuthor: string;
  /** The item kind. */
  itemKind: number;
  /** Parent list UUID for filtering. */
  parentListUuid?: string;
}

export function ReactionButtons({
  itemEventId,
  itemAddress,
  itemAuthor,
  itemKind,
  parentListUuid,
}: Props) {
  const { toast } = useToast();
  const pubkey = useSigner((s) => s.pubkey);
  const signerStatus = useSigner((s) => s.status);

  const [upCount, setUpCount] = useState(0);
  const [downCount, setDownCount] = useState(0);
  const [myVote, setMyVote] = useState<"+" | "-" | null>(null);
  const [voting, setVoting] = useState(false);
  const subRef = useRef<Subscription | null>(null);

  // Subscribe to reactions for this item
  useEffect(() => {
    const { pool, relays } = ensurePool();
    let ups = 0;
    let downs = 0;
    let mine: "+" | "-" | null = null;

    const sub = pool
      .subscription(relays, { kinds: [7], "#e": [itemEventId] })
      .subscribe({
        next(msg: unknown) {
          if (!isNostrEvent(msg)) return;
          if (msg.kind !== 7) return;
          const content = msg.content;
          if (content === "+") {
            ups++;
            if (pubkey && msg.pubkey === pubkey) mine = "+";
          } else if (content === "-") {
            downs++;
            if (pubkey && msg.pubkey === pubkey) mine = "-";
          }
          setUpCount(ups);
          setDownCount(downs);
          setMyVote(mine);
        },
      });

    subRef.current = sub;

    return () => {
      sub.unsubscribe();
    };
  }, [itemEventId, pubkey]);

  const vote = useCallback(
    async (reaction: "+" | "-") => {
      if (signerStatus !== "connected") {
        toast("Connect your extension to vote.", "error");
        return;
      }
      if (myVote === reaction) return; // already voted this way

      setVoting(true);
      try {
        const template = buildReactionEvent({
          itemEventId,
          itemAddress,
          itemAuthor,
          itemKind,
          parentListUuid,
          reaction,
        });
        await signAndPublish(template);

        // Optimistic update
        if (reaction === "+") {
          setUpCount((c) => c + 1);
          if (myVote === "-") setDownCount((c) => Math.max(0, c - 1));
        } else {
          setDownCount((c) => c + 1);
          if (myVote === "+") setUpCount((c) => Math.max(0, c - 1));
        }
        setMyVote(reaction);
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Failed to vote.",
          "error"
        );
      } finally {
        setVoting(false);
      }
    },
    [
      signerStatus,
      myVote,
      itemEventId,
      itemAddress,
      itemAuthor,
      itemKind,
      parentListUuid,
      toast,
    ]
  );

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => vote("+")}
        disabled={voting || myVote === "+"}
        className={cn(
          "flex items-center gap-1 px-2 py-1 text-[12px] border transition-all duration-150",
          myVote === "+"
            ? "border-green-500/40 text-green-400 bg-green-500/5"
            : "border-rule text-mute hover:text-green-400/60 hover:border-green-500/30",
          "disabled:cursor-default"
        )}
        style={{ borderRadius: "var(--radius-input)" }}
        title="Upvote"
      >
        <span className="text-[14px] leading-none">&uarr;</span>
        {upCount > 0 ? (
          <span className="font-mono text-[11px] tabular-nums">{upCount}</span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => vote("-")}
        disabled={voting || myVote === "-"}
        className={cn(
          "flex items-center gap-1 px-2 py-1 text-[12px] border transition-all duration-150",
          myVote === "-"
            ? "border-red-500/30 text-red-400 bg-red-500/5"
            : "border-rule text-mute hover:text-ink-soft hover:border-rule-strong",
          "disabled:cursor-default"
        )}
        style={{ borderRadius: "var(--radius-input)" }}
        title="Downvote"
      >
        <span className="text-[14px] leading-none">&darr;</span>
        {downCount > 0 ? (
          <span className="font-mono text-[11px] tabular-nums">{downCount}</span>
        ) : null}
      </button>
    </div>
  );
}

function isNostrEvent(msg: unknown): msg is NostrEvent {
  if (!msg || typeof msg !== "object") return false;
  const obj = msg as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.kind === "number" &&
    typeof obj.pubkey === "string" &&
    Array.isArray(obj.tags)
  );
}

"use client";

import Link from "next/link";
import { useConnectSigner } from "@/hooks/use-connect-signer";
import { useProfile } from "@/hooks/use-profile";
import { profileDisplayName } from "@/lib/format";

export function SiteHeader() {
  const { status, pubkey, connect, disconnect } = useConnectSigner();
  const profile = useProfile(status === "connected" ? pubkey ?? undefined : undefined);

  const displayName = pubkey ? profileDisplayName(profile, pubkey) : "";
  const picture = profile?.picture;

  return (
    <header className="border-b border-rule bg-surface/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto max-w-[1100px] px-8 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5"
        >
          <span className="inline-block w-2 h-2 bg-accent" style={{ borderRadius: "1px" }} />
          <span className="font-serif text-[20px] font-semibold tracking-[-0.01em] text-ink">
            Curate
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-[13px]">
          <Link
            href="/"
            className="text-ink-soft hover:text-ink transition-colors duration-150"
          >
            Discover
          </Link>
          <Link
            href="/create"
            className="text-ink-soft hover:text-ink transition-colors duration-150"
          >
            Create
          </Link>
          <Link
            href="/settings"
            className="text-ink-soft hover:text-ink transition-colors duration-150"
          >
            Settings
          </Link>

          <span className="w-px h-4 bg-rule" />

          {status === "connected" && pubkey ? (
            <button
              type="button"
              onClick={disconnect}
              className="flex items-center gap-2 px-2.5 py-1 bg-surface-raised text-ink-soft hover:text-ink border border-rule transition-colors duration-150"
              title="Click to disconnect"
              style={{ borderRadius: "var(--radius-input)" }}
            >
              {picture ? (
                <img
                  src={picture}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="w-5 h-5 rounded-full bg-rule flex items-center justify-center text-[10px] text-mute">
                  {displayName[0]?.toUpperCase() ?? "?"}
                </span>
              )}
              <span className="text-[12px] max-w-[120px] truncate">{displayName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={status === "connecting"}
              className="text-[12px] font-medium px-3 py-1.5 bg-accent text-ink hover:brightness-110 transition-all duration-150 disabled:opacity-50"
              style={{ borderRadius: "var(--radius-input)" }}
            >
              {status === "connecting" ? "Connecting..." : "Connect"}
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

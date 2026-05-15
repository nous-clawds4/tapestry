"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/settings";
import { isValidRelayUrl, normalizeRelayUrl, DEFAULT_RELAYS } from "@/lib/nostr/relays";
import { setRelayUrls } from "@/lib/nostr/ndk";
import { useToast } from "@/components/toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const relays = useSettings((s) => s.relays);
  const wotEndpoint = useSettings((s) => s.wotEndpoint);
  const addRelay = useSettings((s) => s.addRelay);
  const removeRelay = useSettings((s) => s.removeRelay);
  const resetRelays = useSettings((s) => s.resetRelays);
  const setWotEndpoint = useSettings((s) => s.setWotEndpoint);

  const [newRelay, setNewRelay] = useState("");
  const [relayError, setRelayError] = useState("");

  const handleAddRelay = () => {
    const url = normalizeRelayUrl(newRelay);
    if (!isValidRelayUrl(url)) {
      setRelayError("Must be a valid wss:// URL");
      return;
    }
    if (relays.includes(url)) {
      setRelayError("Already in your relay set");
      return;
    }
    addRelay(url);
    setRelayUrls([...relays, url]);
    setNewRelay("");
    setRelayError("");
    toast("Relay added.", "success");
  };

  const handleRemoveRelay = (url: string) => {
    removeRelay(url);
    const remaining = relays.filter((r) => r !== url);
    setRelayUrls(remaining.length ? remaining : [...DEFAULT_RELAYS]);
    toast("Relay removed.", "info");
  };

  const handleReset = () => {
    resetRelays();
    setRelayUrls([...DEFAULT_RELAYS]);
    toast("Relays reset to defaults.", "info");
  };

  return (
    <div className="mx-auto max-w-[700px] px-8 py-12">
      <Link
        href="/"
        className="text-[13px] text-mute hover:text-ink-soft transition-colors"
      >
        &larr; Back
      </Link>

      <h1 className="mt-8 font-serif text-[32px] leading-[1.1] tracking-[-0.015em] text-ink font-light">
        Settings
      </h1>

      {/* Relays */}
      <section className="mt-10">
        <h2 className="text-[14px] font-medium text-ink mb-1">Relays</h2>
        <p className="text-[12px] text-mute mb-4">
          Curate reads and writes events to these relays. Add or remove to customize your view.
        </p>

        <div className="flex flex-col gap-2 mb-4">
          {relays.map((url) => {
            const isDefault = (DEFAULT_RELAYS as readonly string[]).includes(url);
            return (
              <div
                key={url}
                className="flex items-center justify-between gap-3 border border-rule bg-surface px-4 py-2.5 group"
                style={{ borderRadius: "var(--radius-card)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-block w-1.5 h-1.5 bg-accent/60 flex-shrink-0" style={{ borderRadius: "50%" }} />
                  <span className="font-mono text-[13px] text-ink truncate">
                    {url}
                  </span>
                  {isDefault ? (
                    <span className="text-[10px] text-mute/50 uppercase tracking-wider flex-shrink-0">
                      default
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRelay(url)}
                  className="text-[12px] text-mute hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newRelay}
            onChange={(e) => {
              setNewRelay(e.target.value);
              setRelayError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddRelay();
              }
            }}
            placeholder="wss://relay.example.com"
            className={cn(
              "flex-1 bg-surface text-ink placeholder:text-mute/50 border px-3 py-2 text-[13px] font-mono outline-none transition-all duration-200",
              relayError
                ? "border-red-500/50 focus:border-red-500/70"
                : "border-rule focus:border-rule-strong focus:bg-surface-hover"
            )}
            style={{ borderRadius: "var(--radius-input)" }}
          />
          <button
            type="button"
            onClick={handleAddRelay}
            disabled={!newRelay.trim()}
            className="text-[12px] px-4 py-2 bg-surface-raised border border-rule text-ink-soft hover:text-ink transition-colors disabled:opacity-40"
            style={{ borderRadius: "var(--radius-input)" }}
          >
            Add
          </button>
        </div>
        {relayError ? (
          <p className="mt-1.5 text-[11px] text-red-400">{relayError}</p>
        ) : null}

        <button
          type="button"
          onClick={handleReset}
          className="mt-3 text-[11px] text-mute hover:text-ink-soft transition-colors"
        >
          Reset to defaults
        </button>
      </section>

      {/* WoT endpoint */}
      <section className="mt-12 border-t border-rule pt-8">
        <h2 className="text-[14px] font-medium text-ink mb-1">
          Web of Trust endpoint
          <span className="ml-2 text-[10px] text-mute uppercase tracking-wider">v1.1</span>
        </h2>
        <p className="text-[12px] text-mute mb-4">
          Optional GrapeRank API for filtering by trust score. Not yet active in this version.
        </p>
        <input
          type="url"
          value={wotEndpoint}
          onChange={(e) => setWotEndpoint(e.target.value)}
          placeholder="https://graperank.example.com/api"
          className="w-full bg-surface text-ink placeholder:text-mute/50 border border-rule px-3 py-2 text-[13px] font-mono outline-none focus:border-rule-strong focus:bg-surface-hover transition-all duration-200"
          style={{ borderRadius: "var(--radius-input)" }}
        />
      </section>

      {/* About */}
      <section className="mt-12 border-t border-rule pt-8">
        <h2 className="text-[14px] font-medium text-ink mb-1">About</h2>
        <p className="text-[12px] text-mute leading-[1.6]">
          Curate is a collaborative list tool built on the{" "}
          <span className="text-ink-soft">Decentralized Lists</span> nostr protocol.
          Events are signed by your browser extension and published to nostr relays.
          Your data is portable, take it anywhere the protocol is supported.
        </p>
        <p className="mt-3 text-[11px] text-mute/50">
          Event kinds 9998/39998 for headers, 9999/39999 for items, 7 for reactions
        </p>
      </section>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { buildListItemEvent } from "@/lib/nostr/events";
import { signAndPublish } from "@/lib/nostr/publish";
import { parseListItem } from "@/lib/nostr/parsers";
import { useSigner } from "@/stores/signer";
import { useToast } from "@/components/toast";
import type { ListHeader, ListItem } from "@/lib/nostr/types";

interface Props {
  header: ListHeader;
  /** Called with the published item for optimistic local insertion. */
  onPublished?: (item: ListItem) => void;
  onCancel?: () => void;
}

export function AddItemForm({ header, onPublished, onCancel }: Props) {
  const { toast } = useToast();
  const pubkey = useSigner((s) => s.pubkey);
  const signerStatus = useSigner((s) => s.status);
  const [publishing, setPublishing] = useState(false);

  // Build field state from schema
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of header.schema) {
      init[f.name] = "";
    }
    // Always have a name field if schema is unknown
    if (header.schemaUnknown) {
      init["name"] = "";
    }
    return init;
  });

  // Extra meta fields
  const [description, setDescription] = useState("");

  const setValue = (name: string, val: string) => {
    setValues((prev) => ({ ...prev, [name]: val }));
  };

  const canSubmit = () => {
    if (signerStatus !== "connected") return false;
    // All required fields must be non-empty
    for (const f of header.schema) {
      if (f.presence === "required" && !values[f.name]?.trim()) return false;
    }
    // For unknown schema, need at least a name
    if (header.schemaUnknown && !values["name"]?.trim()) return false;
    return true;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit()) return;

      setPublishing(true);
      try {
        // Split values into fields (custom tags) vs reserved tags
        const fields: Record<string, string> = {};
        let itemName: string | undefined;

        for (const [key, val] of Object.entries(values)) {
          if (!val.trim()) continue;
          if (key === "name") {
            itemName = val.trim();
          } else {
            fields[key] = val.trim();
          }
        }

        const template = buildListItemEvent({
          parentListUuid: header.uuid,
          fields,
          name: itemName,
          description: description.trim() || undefined,
        });

        const result = await signAndPublish(template);
        toast(
          `Added to ${result.accepted} relay${result.accepted === 1 ? "" : "s"}.`,
          "success"
        );
        // Parse the signed event back into a ListItem for optimistic insertion
        const parsed = parseListItem(result.event);
        if (parsed) {
          onPublished?.(parsed);
        }
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Failed to add item.",
          "error"
        );
      } finally {
        setPublishing(false);
      }
    },
    [values, description, header, toast, onPublished]
  );

  const schemaFields = header.schemaUnknown
    ? [{ name: "name", type: "text" as const, presence: "required" as const }]
    : header.schema;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[18px] text-ink">
          Add {header.nameSingular}
        </h3>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-[12px] text-mute hover:text-ink-soft transition-colors"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {schemaFields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1">
          <span className="text-[12px] text-ink-soft">
            {f.name}
            {f.presence === "required" ? (
              <span className="text-accent ml-1">*</span>
            ) : (
              <span className="text-mute/50 ml-1">(optional)</span>
            )}
          </span>
          {f.type === "long-text" ? (
            <textarea
              value={values[f.name] ?? ""}
              onChange={(e) => setValue(f.name, e.target.value)}
              rows={3}
              className={cn(inputClass, "resize-none")}
              style={inputStyle}
              placeholder={f.name}
            />
          ) : f.type === "boolean" ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setValue(
                    f.name,
                    values[f.name] === "true" ? "" : "true"
                  )
                }
                className={cn(
                  "text-[12px] px-3 py-1.5 border transition-colors",
                  values[f.name] === "true"
                    ? "border-accent/40 text-accent bg-accent-glow"
                    : "border-rule text-mute"
                )}
                style={{ borderRadius: "var(--radius-input)" }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() =>
                  setValue(
                    f.name,
                    values[f.name] === "false" ? "" : "false"
                  )
                }
                className={cn(
                  "text-[12px] px-3 py-1.5 border transition-colors",
                  values[f.name] === "false"
                    ? "border-accent/40 text-accent bg-accent-glow"
                    : "border-rule text-mute"
                )}
                style={{ borderRadius: "var(--radius-input)" }}
              >
                No
              </button>
            </div>
          ) : (
            <input
              type={f.type === "number" ? "number" : f.type === "url" ? "url" : f.type === "date" ? "date" : "text"}
              value={values[f.name] ?? ""}
              onChange={(e) => setValue(f.name, e.target.value)}
              placeholder={f.name}
              className={inputClass}
              style={inputStyle}
            />
          )}
        </label>
      ))}

      {/* Optional description always available */}
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-ink-soft">
          Description <span className="text-mute/50">(optional)</span>
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={cn(inputClass, "resize-none")}
          style={inputStyle}
          placeholder="Notes about this item..."
        />
      </label>

      <div className="flex items-center justify-end gap-3 mt-2">
        {signerStatus !== "connected" ? (
          <p className="text-[12px] text-accent mr-auto">
            Connect your extension to add items.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!canSubmit() || publishing}
          className="text-[13px] font-medium px-5 py-2 bg-accent text-ink hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderRadius: "var(--radius-input)" }}
        >
          {publishing ? "Adding..." : `Add ${header.nameSingular}`}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full bg-surface text-ink placeholder:text-mute/50 border border-rule px-3 py-2 text-[14px] outline-none focus:border-rule-strong focus:bg-surface-hover transition-all duration-200";

const inputStyle = { borderRadius: "var(--radius-input)" as const };

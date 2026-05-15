"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { singularize } from "@/lib/nostr/pluralize";
import { buildListHeaderEvent } from "@/lib/nostr/events";
import { signAndPublish } from "@/lib/nostr/publish";
import { parseListHeader } from "@/lib/nostr/parsers";
import { useSigner } from "@/stores/signer";
import { useToast } from "@/components/toast";
import type { ListHeader, FieldSchema, FieldType } from "@/lib/nostr/types";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "long-text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "url", label: "URL" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
];

interface DraftField {
  id: string;
  name: string;
  type: FieldType;
  presence: "required" | "allowed";
  description: string;
}

interface Props {
  header: ListHeader;
  onUpdated?: (updated: ListHeader) => void;
  onCancel?: () => void;
}

export function EditHeaderForm({ header, onUpdated, onCancel }: Props) {
  const { toast } = useToast();
  const signerStatus = useSigner((s) => s.status);
  const [publishing, setPublishing] = useState(false);

  // Pre-fill from current header
  const [namePlural, setNamePlural] = useState(header.namePlural);
  const [nameSingular, setNameSingular] = useState(header.nameSingular);
  const [description, setDescription] = useState(header.description ?? "");

  // Schema fields
  const [fields, setFields] = useState<DraftField[]>(() =>
    header.schema.length > 0
      ? header.schema.map((f, i) => ({
          id: `f${i}`,
          name: f.name,
          type: f.type,
          presence: f.presence === "recommended" ? "allowed" : f.presence,
          description: f.description ?? "",
        }))
      : [{ id: "f0", name: "name", type: "text" as const, presence: "required" as const, description: "" }]
  );

  // Topics
  const [topicInput, setTopicInput] = useState("");
  const [topics, setTopics] = useState<string[]>(header.topics);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { id: `f${Date.now()}`, name: "", type: "text", presence: "allowed", description: "" },
    ]);
  };

  const updateField = (id: string, patch: Partial<DraftField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const addTopic = () => {
    const t = topicInput.trim().toLowerCase();
    if (t && !topics.includes(t)) setTopics((prev) => [...prev, t]);
    setTopicInput("");
  };

  const removeTopic = (t: string) => {
    setTopics((prev) => prev.filter((x) => x !== t));
  };

  const canSubmit =
    signerStatus === "connected" &&
    namePlural.trim().length >= 2 &&
    fields.every((f) => f.name.trim().length > 0);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;

      setPublishing(true);
      try {
        const schema: FieldSchema[] = fields
          .filter((f) => f.name.trim())
          .map((f) => ({
            name: f.name.trim().toLowerCase().replace(/\s+/g, "-"),
            type: f.type,
            presence: f.presence,
            description: f.description.trim() || undefined,
          }));

        const template = buildListHeaderEvent({
          namePlural: namePlural.trim(),
          nameSingular: nameSingular.trim() || singularize(namePlural.trim()),
          description: description.trim() || undefined,
          topics: topics.length > 0 ? topics : undefined,
          schema,
          // Preserve the existing d-tag so this replaces the original
          dTag: header.dTag ?? undefined,
        });

        const result = await signAndPublish(template);
        toast(
          `Updated on ${result.accepted} relay${result.accepted === 1 ? "" : "s"}.`,
          "success"
        );

        const parsed = parseListHeader(result.event);
        if (parsed) {
          onUpdated?.(parsed);
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to update.", "error");
      } finally {
        setPublishing(false);
      }
    },
    [canSubmit, namePlural, nameSingular, description, topics, fields, header, toast, onUpdated]
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[18px] text-ink">Edit list</h3>
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

      {/* Basics */}
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ink-soft">
            List name (plural) <span className="text-accent">*</span>
          </span>
          <input
            type="text"
            value={namePlural}
            onChange={(e) => setNamePlural(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ink-soft">Singular form</span>
          <input
            type="text"
            value={nameSingular}
            onChange={(e) => setNameSingular(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ink-soft">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={cn(inputClass, "resize-none")}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Schema */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] text-ink-soft">Fields</span>
        {fields.map((f) => (
          <div
            key={f.id}
            className="border border-rule bg-surface-hover p-3 flex items-center gap-2"
            style={{ borderRadius: "var(--radius-input)" }}
          >
            <input
              type="text"
              value={f.name}
              onChange={(e) => updateField(f.id, { name: e.target.value })}
              placeholder="Field name"
              className={cn(inputClass, "flex-1 text-[13px]")}
              style={inputStyle}
            />
            <select
              value={f.type}
              onChange={(e) => updateField(f.id, { type: e.target.value as FieldType })}
              className="bg-surface border border-rule text-ink text-[12px] px-2 py-2 outline-none"
              style={{ borderRadius: "var(--radius-input)" }}
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                updateField(f.id, {
                  presence: f.presence === "required" ? "allowed" : "required",
                })
              }
              className={cn(
                "text-[10px] uppercase tracking-wider px-2 py-2 border transition-colors whitespace-nowrap",
                f.presence === "required"
                  ? "border-accent/30 text-accent"
                  : "border-rule text-mute"
              )}
              style={{ borderRadius: "var(--radius-input)" }}
            >
              {f.presence === "required" ? "Req" : "Opt"}
            </button>
            {fields.length > 1 ? (
              <button
                type="button"
                onClick={() => removeField(f.id)}
                className="text-mute hover:text-accent transition-colors text-[16px] leading-none px-1"
              >
                &times;
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          onClick={addField}
          className="text-[12px] text-accent hover:text-ink transition-colors self-start"
        >
          + Add field
        </button>
      </div>

      {/* Topics */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] text-ink-soft">Topics</span>
        <div className="flex gap-2">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTopic(); }
            }}
            placeholder="Add a topic..."
            className={cn(inputClass, "flex-1 text-[13px]")}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={addTopic}
            disabled={!topicInput.trim()}
            className="text-[12px] px-3 py-2 bg-surface-raised border border-rule text-ink-soft hover:text-ink transition-colors disabled:opacity-40"
            style={{ borderRadius: "var(--radius-input)" }}
          >
            Add
          </button>
        </div>
        {topics.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => removeTopic(t)}
                className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 border border-accent/30 text-accent bg-accent-glow hover:bg-accent/10 transition-colors"
                style={{ borderRadius: "var(--radius-input)" }}
                title="Click to remove"
              >
                {t} <span className="ml-0.5 opacity-50">&times;</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 mt-1">
        <button
          type="submit"
          disabled={!canSubmit || publishing}
          className="text-[13px] font-medium px-5 py-2 bg-accent text-ink hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderRadius: "var(--radius-input)" }}
        >
          {publishing ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full bg-surface text-ink placeholder:text-mute/50 border border-rule px-3 py-2 text-[14px] outline-none focus:border-rule-strong focus:bg-surface-hover transition-all duration-200";

const inputStyle = { borderRadius: "var(--radius-input)" as const };

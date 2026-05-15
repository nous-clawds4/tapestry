"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { singularize } from "@/lib/nostr/pluralize";
import { buildListHeaderEvent, listHeaderUuid } from "@/lib/nostr/events";
import { signAndPublish } from "@/lib/nostr/publish";
import { useSigner } from "@/stores/signer";
import { useToast } from "@/components/toast";
import type { FieldSchema, FieldType } from "@/lib/nostr/types";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "long-text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "url", label: "URL" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
];

type Step = "basics" | "schema" | "topics" | "review";
const STEPS: { key: Step; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "schema", label: "Fields" },
  { key: "topics", label: "Topics" },
  { key: "review", label: "Review" },
];

interface DraftField {
  id: string;
  name: string;
  type: FieldType;
  presence: "required" | "allowed";
  description: string;
}

export default function CreateListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const pubkey = useSigner((s) => s.pubkey);
  const signerStatus = useSigner((s) => s.status);

  const [step, setStep] = useState<Step>("basics");
  const [publishing, setPublishing] = useState(false);

  // Basics
  const [namePlural, setNamePlural] = useState("");
  const [nameSingular, setNameSingular] = useState("");
  const [singularEdited, setSingularEdited] = useState(false);
  const [description, setDescription] = useState("");

  // Schema
  const [fields, setFields] = useState<DraftField[]>([
    { id: "f1", name: "name", type: "text", presence: "required", description: "" },
  ]);

  // Topics
  const [topicInput, setTopicInput] = useState("");
  const [topics, setTopics] = useState<string[]>([]);

  // Auto-derive singular from plural
  const handlePluralChange = (val: string) => {
    setNamePlural(val);
    if (!singularEdited) {
      setNameSingular(singularize(val));
    }
  };

  // Schema field CRUD
  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        id: `f${Date.now()}`,
        name: "",
        type: "text",
        presence: "allowed",
        description: "",
      },
    ]);
  };

  const updateField = (id: string, patch: Partial<DraftField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  // Topic add
  const addTopic = () => {
    const t = topicInput.trim().toLowerCase();
    if (t && !topics.includes(t)) {
      setTopics((prev) => [...prev, t]);
    }
    setTopicInput("");
  };

  const removeTopic = (t: string) => {
    setTopics((prev) => prev.filter((x) => x !== t));
  };

  // Validation
  const canProceed = (s: Step): boolean => {
    switch (s) {
      case "basics":
        return namePlural.trim().length >= 2;
      case "schema":
        return fields.every((f) => f.name.trim().length > 0);
      case "topics":
        return true;
      case "review":
        return true;
    }
  };

  const nextStep = () => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
  };

  const prevStep = () => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
  };

  // Publish
  const handlePublish = useCallback(async () => {
    if (signerStatus !== "connected" || !pubkey) {
      toast("Connect your nostr extension first.", "error");
      return;
    }

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
        nameSingular: (nameSingular.trim() || singularize(namePlural.trim())),
        description: description.trim() || undefined,
        topics: topics.length > 0 ? topics : undefined,
        schema,
      });

      const result = await signAndPublish(template);
      const dTag = template.tags.find((t) => t[0] === "d")?.[1] ?? "";
      const uuid = listHeaderUuid(pubkey, dTag);

      toast(`Published to ${result.accepted} relay${result.accepted === 1 ? "" : "s"}.`, "success");
      router.push(`/list/${encodeURIComponent(uuid)}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to publish.", "error");
    } finally {
      setPublishing(false);
    }
  }, [signerStatus, pubkey, namePlural, nameSingular, description, topics, fields, toast, router]);

  return (
    <div className="mx-auto max-w-[700px] px-8 py-12">
      <Link
        href="/"
        className="text-[13px] text-mute hover:text-ink-soft transition-colors"
      >
        &larr; Back
      </Link>

      <h1 className="mt-8 font-serif text-[32px] leading-[1.1] tracking-[-0.015em] text-ink font-light">
        Create a new{" "}
        <span className="italic text-accent font-normal">list</span>
      </h1>

      {/* Step indicator */}
      <div className="mt-8 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              // Allow going back, but not forward past current step
              const curIdx = STEPS.findIndex((x) => x.key === step);
              if (i <= curIdx) setStep(s.key);
            }}
            className={cn(
              "text-[11px] uppercase tracking-[0.1em] px-3 py-1.5 border transition-all duration-150",
              step === s.key
                ? "border-accent/40 text-accent bg-accent-glow"
                : i < STEPS.findIndex((x) => x.key === step)
                  ? "border-rule-strong text-ink-soft"
                  : "border-rule text-mute"
            )}
            style={{ borderRadius: "var(--radius-input)" }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="mt-8">
        {step === "basics" ? (
          <div className="flex flex-col gap-5">
            <Field label="List name (plural)" required hint="e.g. Movies, Restaurants, Podcasts">
              <input
                type="text"
                value={namePlural}
                onChange={(e) => handlePluralChange(e.target.value)}
                placeholder="Movies"
                className={inputClass}
                style={inputStyle}
                autoFocus
              />
            </Field>
            <Field label="Singular form" hint="Auto-derived. Override if needed.">
              <input
                type="text"
                value={nameSingular}
                onChange={(e) => {
                  setNameSingular(e.target.value);
                  setSingularEdited(true);
                }}
                placeholder="Movie"
                className={inputClass}
                style={inputStyle}
              />
            </Field>
            <Field label="Description" hint="What is this list about?">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A curated collection of..."
                rows={3}
                className={cn(inputClass, "resize-none")}
                style={inputStyle}
              />
            </Field>
          </div>
        ) : step === "schema" ? (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-ink-soft">
              Define what fields each item in your list will have.
            </p>
            {fields.map((f, i) => (
              <div
                key={f.id}
                className="border border-rule bg-surface p-4 flex flex-col gap-3"
                style={{ borderRadius: "var(--radius-card)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={f.name}
                      onChange={(e) =>
                        updateField(f.id, { name: e.target.value })
                      }
                      placeholder="Field name"
                      className={cn(inputClass, "text-[14px]")}
                      style={inputStyle}
                    />
                  </div>
                  <select
                    value={f.type}
                    onChange={(e) =>
                      updateField(f.id, { type: e.target.value as FieldType })
                    }
                    className="bg-surface-raised border border-rule text-ink text-[13px] px-2 py-2 outline-none"
                    style={{ borderRadius: "var(--radius-input)" }}
                  >
                    {FIELD_TYPES.map((ft) => (
                      <option key={ft.value} value={ft.value}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      updateField(f.id, {
                        presence:
                          f.presence === "required" ? "allowed" : "required",
                      })
                    }
                    className={cn(
                      "text-[11px] uppercase tracking-wider px-2 py-2 border transition-colors",
                      f.presence === "required"
                        ? "border-accent/30 text-accent"
                        : "border-rule text-mute"
                    )}
                    style={{ borderRadius: "var(--radius-input)" }}
                  >
                    {f.presence === "required" ? "Required" : "Optional"}
                  </button>
                  {fields.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeField(f.id)}
                      className="text-mute hover:text-accent transition-colors text-[18px] leading-none px-1 py-2"
                      title="Remove field"
                    >
                      &times;
                    </button>
                  ) : null}
                </div>
                <input
                  type="text"
                  value={f.description}
                  onChange={(e) =>
                    updateField(f.id, { description: e.target.value })
                  }
                  placeholder="Description (optional)"
                  className={cn(inputClass, "text-[12px] text-mute")}
                  style={inputStyle}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addField}
              className="text-[13px] text-accent hover:text-ink transition-colors self-start py-1"
            >
              + Add field
            </button>
          </div>
        ) : step === "topics" ? (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-ink-soft">
              Add category tags so people can find your list.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTopic();
                  }
                }}
                placeholder="e.g. music, film, tech"
                className={cn(inputClass, "flex-1")}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={addTopic}
                disabled={!topicInput.trim()}
                className="text-[13px] px-4 py-2 bg-surface-raised border border-rule text-ink-soft hover:text-ink transition-colors disabled:opacity-40"
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
                    className="text-[10px] uppercase tracking-[0.1em] px-2.5 py-1 border border-accent/30 text-accent bg-accent-glow hover:bg-accent/10 transition-colors group"
                    style={{ borderRadius: "var(--radius-input)" }}
                    title="Click to remove"
                  >
                    {t} <span className="ml-1 opacity-50 group-hover:opacity-100">&times;</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-mute italic">No topics yet. This is optional.</p>
            )}
          </div>
        ) : step === "review" ? (
          <div className="flex flex-col gap-6">
            <div
              className="border border-rule bg-surface p-6"
              style={{ borderRadius: "var(--radius-card)" }}
            >
              <h2 className="font-serif text-[24px] leading-[1.15] text-ink">
                {capitalize(namePlural.trim()) || "Untitled"}
              </h2>
              {nameSingular.trim() ? (
                <p className="mt-1 text-[12px] text-mute">
                  Singular form is {nameSingular.trim()}
                </p>
              ) : null}
              {description.trim() ? (
                <p className="mt-3 font-serif text-[14px] text-ink-soft italic">
                  {description.trim()}
                </p>
              ) : null}
              {topics.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {topics.map((t) => (
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
              {fields.filter((f) => f.name.trim()).length > 0 ? (
                <div className="mt-4 border-t border-rule pt-3">
                  <p className="text-[11px] uppercase tracking-wider text-mute mb-2">
                    Fields
                  </p>
                  {fields
                    .filter((f) => f.name.trim())
                    .map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 text-[13px] py-1"
                      >
                        <span className="text-ink">{f.name}</span>
                        <span className="text-mute/60">{f.type}</span>
                        <span
                          className={cn(
                            "text-[10px] uppercase tracking-wider",
                            f.presence === "required"
                              ? "text-accent"
                              : "text-mute/50"
                          )}
                        >
                          {f.presence}
                        </span>
                      </div>
                    ))}
                </div>
              ) : null}
            </div>

            {signerStatus !== "connected" ? (
              <p className="text-[13px] text-accent">
                Connect your nostr extension to publish.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        {step !== "basics" ? (
          <button
            type="button"
            onClick={prevStep}
            className="text-[13px] text-mute hover:text-ink-soft transition-colors"
          >
            &larr; Back
          </button>
        ) : (
          <div />
        )}

        {step !== "review" ? (
          <button
            type="button"
            onClick={nextStep}
            disabled={!canProceed(step)}
            className="text-[13px] font-medium px-5 py-2 bg-surface-raised border border-rule text-ink hover:border-rule-strong transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderRadius: "var(--radius-input)" }}
          >
            Next &rarr;
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || signerStatus !== "connected"}
            className="text-[13px] font-medium px-6 py-2 bg-accent text-ink hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: "var(--radius-input)" }}
          >
            {publishing ? "Publishing..." : "Publish list"}
          </button>
        )}
      </div>
    </div>
  );
}

// -- sub-components --------------------------------------------------------

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] text-ink-soft">
        {label}
        {required ? <span className="text-accent ml-1">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="text-[11px] text-mute/60">{hint}</span>
      ) : null}
    </label>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

const inputClass =
  "w-full bg-surface text-ink placeholder:text-mute/50 border border-rule px-3 py-2 text-[14px] outline-none focus:border-rule-strong focus:bg-surface-hover transition-all duration-200";

const inputStyle = { borderRadius: "var(--radius-input)" };

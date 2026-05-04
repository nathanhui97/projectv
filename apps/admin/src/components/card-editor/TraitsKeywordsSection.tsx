"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { useState } from "react";
import type { CardFormValues } from "@/app/(admin)/cards/[id]/CardEditor";
import { Field } from "./FormPrimitives";
import { X, Plus } from "lucide-react";

const ALL_KEYWORDS = [
  "repair", "breach", "support", "blocker",
  "first_strike", "high_maneuver", "suppression",
] as const;

type Trait = { slug: string; display_name: string };

export default function TraitsKeywordsSection({ traits }: { traits: Trait[] }) {
  const { register, watch, setValue } = useFormContext<CardFormValues>();
  const { fields, append, remove } = useFieldArray({ name: "keywords" } as never);
  const selectedTraits: string[] = watch("traits") ?? [];
  const selectedKeywords = (watch("keywords") ?? []) as { keyword: string; amount?: number }[];
  const [traitInput, setTraitInput] = useState("");

  function addTrait(slug: string) {
    if (!slug || selectedTraits.includes(slug)) return;
    setValue("traits", [...selectedTraits, slug], { shouldDirty: true });
    setTraitInput("");
  }

  function removeTrait(slug: string) {
    setValue("traits", selectedTraits.filter((t) => t !== slug), { shouldDirty: true });
  }

  const availableTraits = traits.filter((t) => !selectedTraits.includes(t.slug));
  const filteredTraits = traitInput
    ? availableTraits.filter(
        (t) =>
          t.slug.includes(traitInput.toLowerCase()) ||
          t.display_name.toLowerCase().includes(traitInput.toLowerCase())
      )
    : availableTraits;

  const usedKeywords = new Set(selectedKeywords.map((k) => k.keyword));

  return (
    <section className="space-y-6">
      {/* Traits */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Traits
        </h2>
        <div className="flex flex-wrap gap-2 mb-2 min-h-8">
          {selectedTraits.map((slug) => {
            const trait = traits.find((t) => t.slug === slug);
            return (
              <span
                key={slug}
                className="flex items-center gap-1 px-2 py-0.5 bg-secondary rounded-full text-xs"
              >
                {trait?.display_name ?? slug}
                <button
                  type="button"
                  onClick={() => removeTrait(slug)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {selectedTraits.length === 0 && (
            <span className="text-sm text-muted-foreground italic">No traits selected</span>
          )}
        </div>
        <div className="relative">
          <input
            value={traitInput}
            onChange={(e) => setTraitInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // allow free-text slugs (for new traits not yet in DB)
                const slug = traitInput.trim().toLowerCase().replace(/\s+/g, "_");
                addTrait(slug);
              }
            }}
            placeholder="Search or type a trait slug, press Enter to add…"
            className="input"
          />
          {traitInput && filteredTraits.length > 0 && (
            <div className="absolute z-10 mt-1 w-full border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto">
              {filteredTraits.slice(0, 20).map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => addTrait(t.slug)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="font-medium">{t.display_name}</span>
                  <span className="ml-2 text-muted-foreground text-xs">{t.slug}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Keywords */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Keywords
        </h2>
        <div className="space-y-2">
          {(fields as { id: string }[]).map((field, index) => {
            const kw = selectedKeywords[index];
            const needsAmount = kw?.keyword === "repair" || kw?.keyword === "breach";
            return (
              <div key={field.id} className="flex items-center gap-2">
                <select
                  {...register(`keywords.${index}.keyword` as const)}
                  className="input flex-1"
                >
                  {ALL_KEYWORDS.map((k) => (
                    <option key={k} value={k} disabled={usedKeywords.has(k) && k !== kw?.keyword}>
                      {k.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                {needsAmount && (
                  <input
                    type="number"
                    min={0}
                    {...register(`keywords.${index}.amount` as const)}
                    className="input w-20"
                    placeholder="Amt"
                  />
                )}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {usedKeywords.size < ALL_KEYWORDS.length && (
            <button
              type="button"
              onClick={() => (append as (v: unknown) => void)({ keyword: ALL_KEYWORDS.find((k) => !usedKeywords.has(k))!, amount: undefined })}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Add keyword
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

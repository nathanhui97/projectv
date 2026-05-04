"use client";

import { useFormContext } from "react-hook-form";
import { useState } from "react";
import type { CardFormValues } from "@/app/(admin)/cards/[id]/CardEditor";
import { Field } from "./FormPrimitives";
import { Sparkles, Loader2 } from "lucide-react";

export default function RulesTextSection() {
  const { register, watch, setValue } = useFormContext<CardFormValues>();
  const [filling, setFilling] = useState(false);
  const [fillError, setFillError] = useState<string | null>(null);
  const manualMode: boolean = watch("manual_mode");

  async function handleAIFill() {
    const rulesText: string = watch("rules_text");
    if (!rulesText.trim()) return;
    setFilling(true);
    setFillError(null);
    try {
      const res = await fetch("/api/cards/ai-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules_text: rulesText }),
      });
      if (!res.ok) throw new Error("AI fill failed");
      const { abilities } = await res.json() as { abilities: unknown[] };
      setValue("abilities", abilities, { shouldDirty: true });
    } catch (e) {
      setFillError(e instanceof Error ? e.message : "Failed");
    } finally {
      setFilling(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
        Rules Text
      </h2>

      <Field label="Rules Text">
        <textarea
          {...register("rules_text")}
          rows={4}
          placeholder="Enter the card's printed rules text…"
          className="input resize-y"
        />
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleAIFill}
          disabled={filling}
          className="flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm hover:bg-accent disabled:opacity-50"
        >
          {filling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          AI Auto-fill Abilities
        </button>
        {fillError && <span className="text-xs text-destructive">{fillError}</span>}
      </div>

      <Field label="Authoring Notes">
        <textarea
          {...register("authoring_notes")}
          rows={2}
          placeholder="Internal notes, rulings clarifications…"
          className="input resize-y"
        />
      </Field>

      <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/50">
        <input
          type="checkbox"
          id="manual_mode"
          {...register("manual_mode")}
          className="h-4 w-4"
        />
        <div>
          <label htmlFor="manual_mode" className="text-sm font-medium cursor-pointer">
            Manual Mode
          </label>
          <p className="text-xs text-muted-foreground">
            Card is too complex to encode. Players resolve via prompt text.
          </p>
        </div>
      </div>
    </section>
  );
}

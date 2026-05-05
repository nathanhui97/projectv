"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Globe, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import BasicInfoSection from "@/components/card-editor/BasicInfoSection";
import StatsSection from "@/components/card-editor/StatsSection";
import TraitsKeywordsSection from "@/components/card-editor/TraitsKeywordsSection";
import RulesTextSection from "@/components/card-editor/RulesTextSection";
import AbilitiesBuilder from "@/components/card-editor/AbilitiesBuilder";
import ImageUpload from "@/components/card-editor/ImageUpload";
import CardPreview from "@/components/card-editor/CardPreview";

// Form schema — omits server-managed fields (id, created_at, etc.)
const FormSchema = z.object({
  id: z.string().min(1, "Required"),
  set_code: z.string().min(1, "Required"),
  card_number: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  display_name: z.string().optional(),
  type: z.enum(["unit", "pilot", "command", "base", "resource", "token"]),
  color: z.enum(["blue", "green", "red", "white", "purple"]).optional(),
  rarity: z.enum(["common", "uncommon", "rare", "super_rare", "legendary_rare", "promo"]),
  cost: z.coerce.number().int().nonnegative().optional(),
  level: z.coerce.number().int().nonnegative().optional(),
  ap: z.coerce.number().int().optional(),
  hp: z.coerce.number().int().optional(),
  traits: z.array(z.string()).default([]),
  keywords: z.array(z.object({
    keyword: z.enum(["repair", "breach", "support", "blocker", "first_strike", "high_maneuver", "suppression"]),
    amount: z.coerce.number().int().nonnegative().optional(),
  })).default([]),
  pilot_modifiers: z.object({
    ap_mod: z.coerce.number().int().optional(),
    hp_mod: z.coerce.number().int().optional(),
  }).optional(),
  link_text: z.string().optional(),
  rules_text: z.string().default(""),
  flavor_text: z.string().optional(),
  art_url: z.string().url().optional().or(z.literal("")),
  manual_mode: z.boolean().default(false),
  authoring_notes: z.string().optional(),
  abilities: z.array(z.any()).default([]),
});

export type CardFormValues = z.infer<typeof FormSchema>;

type DbCard = {
  id: string;
  data: Record<string, unknown>;
  status: string;
  set_code: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type Trait = { slug: string; display_name: string };

function cardToFormValues(card: DbCard): CardFormValues {
  const d = (card.data ?? {}) as Record<string, unknown>;
  return {
    id: card.id,
    set_code: card.set_code,
    card_number: (d.card_number as string) ?? "",
    name: (d.name as string) ?? "",
    display_name: (d.display_name as string) ?? undefined,
    type: (d.type as CardFormValues["type"]) ?? "unit",
    color: (d.color as CardFormValues["color"]) ?? undefined,
    rarity: (d.rarity as CardFormValues["rarity"]) ?? "common",
    cost: (d.cost as number) ?? undefined,
    level: (d.level as number) ?? undefined,
    ap: (d.ap as number) ?? undefined,
    hp: (d.hp as number) ?? undefined,
    traits: (d.traits as string[]) ?? [],
    keywords: (d.keywords as CardFormValues["keywords"]) ?? [],
    pilot_modifiers: (d.pilot_modifiers as CardFormValues["pilot_modifiers"]) ?? undefined,
    link_text: (d.link_text as string) ?? undefined,
    rules_text: (d.rules_text as string) ?? "",
    flavor_text: (d.flavor_text as string) ?? undefined,
    art_url: (d.art_url as string) ?? undefined,
    manual_mode: (d.manual_mode as boolean) ?? false,
    authoring_notes: (d.authoring_notes as string) ?? undefined,
    abilities: (d.abilities as unknown[]) ?? [],
  };
}

function defaultFormValues(): CardFormValues {
  return {
    id: "",
    set_code: "",
    card_number: "",
    name: "",
    type: "unit",
    rarity: "common",
    traits: [],
    keywords: [],
    rules_text: "",
    manual_mode: false,
    abilities: [],
  };
}

export default function CardEditor({
  card,
  traits,
}: {
  card: DbCard | null;
  traits: Trait[];
}) {
  const router = useRouter();
  const isNew = card === null;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "abilities">("form");

  const methods = useForm<CardFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: card ? cardToFormValues(card) : defaultFormValues(),
  });

  const { handleSubmit, watch, formState: { errors } } = methods;
  const formValues = watch();

  async function onSave(status: "draft" | "published") {
    const valid = await methods.trigger();
    if (!valid) return;

    const values = methods.getValues();
    setSaving(true);
    setSaveError(null);

    try {
      const url = isNew ? "/api/cards" : `/api/cards/${card.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: values, status }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Save failed");
      }

      const saved = await res.json() as { id: string };
      if (isNew) router.push(`/cards/${saved.id}`);
      else router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <FormProvider {...methods}>
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/cards" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="font-medium text-sm">
              {isNew ? "New Card" : (formValues.name || card.id)}
            </span>
            {!isNew && (
              <StatusBadge status={card.status} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {saveError && (
              <span className="text-xs text-destructive">{saveError}</span>
            )}
            {hasErrors && (
              <span className="text-xs text-destructive">Fix validation errors first</span>
            )}
            <button
              onClick={() => onSave("draft")}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm hover:bg-accent disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save Draft
            </button>
            <button
              onClick={() => onSave("published")}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
            >
              <Globe className="h-3 w-3" />
              Publish
            </button>
          </div>
        </div>

        {/* 3-column body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: image */}
          <div className="w-64 border-r p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
            <ImageUpload cardId={formValues.id || "new"} />
          </div>

          {/* Center: form */}
          <div className="flex-1 overflow-y-auto">
            {/* Tabs */}
            <div className="flex border-b px-6">
              {(["form", "abilities"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition-colors",
                    activeTab === tab
                      ? "border-primary text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "form" ? "Card Info" : "Abilities"}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-6 max-w-2xl">
              {activeTab === "form" && (
                <>
                  <BasicInfoSection />
                  <StatsSection cardType={formValues.type} />
                  <TraitsKeywordsSection traits={traits} />
                  <RulesTextSection />
                </>
              )}
              {activeTab === "abilities" && (
                <AbilitiesBuilder />
              )}
            </div>
          </div>

          {/* Right: live preview */}
          <div className="w-72 border-l p-4 overflow-y-auto shrink-0">
            <CardPreview values={formValues} />
          </div>
        </div>
      </div>
    </FormProvider>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-800",
    published: "bg-green-100 text-green-800",
    errata: "bg-blue-100 text-blue-800",
    banned: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}

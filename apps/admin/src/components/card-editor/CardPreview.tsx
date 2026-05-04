"use client";

import type { CardFormValues } from "@/app/(admin)/cards/[id]/CardEditor";
import Image from "next/image";

export default function CardPreview({ values }: { values: CardFormValues }) {
  const colorBg: Record<string, string> = {
    blue: "bg-blue-100 border-blue-300",
    green: "bg-green-100 border-green-300",
    red: "bg-red-100 border-red-300",
    white: "bg-gray-100 border-gray-300",
  };
  const colorClass = values.color ? colorBg[values.color] : "bg-muted border-border";

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>

      {/* Card mockup */}
      <div className={`rounded-lg border-2 p-3 ${colorClass} space-y-2`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-1">
          <div>
            <p className="font-bold text-sm leading-tight">{values.name || "Card Name"}</p>
            {values.traits.length > 0 && (
              <p className="text-xs text-muted-foreground">{values.traits.join(" / ")}</p>
            )}
          </div>
          {values.cost !== undefined && (
            <span className="shrink-0 w-6 h-6 rounded-full bg-white border text-xs font-bold flex items-center justify-center">
              {values.cost}
            </span>
          )}
        </div>

        {/* Art */}
        <div className="relative aspect-[4/3] rounded bg-white/50 overflow-hidden">
          {values.art_url ? (
            <Image src={values.art_url} alt="Card art" fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
              No art
            </div>
          )}
        </div>

        {/* Type line */}
        <div className="flex items-center justify-between text-xs">
          <span className="capitalize font-medium">{values.type}</span>
          {values.color && (
            <span className="capitalize text-muted-foreground">{values.color}</span>
          )}
        </div>

        {/* Stats */}
        {(values.ap !== undefined || values.hp !== undefined) && (
          <div className="flex gap-3 text-xs">
            {values.ap !== undefined && <span><span className="font-medium">AP</span> {values.ap}</span>}
            {values.hp !== undefined && <span><span className="font-medium">HP</span> {values.hp}</span>}
          </div>
        )}

        {/* Keywords */}
        {values.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {values.keywords.map((kw, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-white/70 rounded text-xs capitalize">
                {kw.keyword.replace(/_/g, " ")}
                {kw.amount !== undefined ? ` ${kw.amount}` : ""}
              </span>
            ))}
          </div>
        )}

        {/* Rules text */}
        {values.rules_text && (
          <p className="text-xs leading-relaxed border-t pt-2">{values.rules_text}</p>
        )}

        {/* Manual mode badge */}
        {values.manual_mode && (
          <p className="text-xs text-orange-700 font-medium">⚠ Manual Mode</p>
        )}
      </div>

      {/* Abilities summary */}
      {values.abilities.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Abilities ({values.abilities.length})
          </p>
          {(values.abilities as { display_text?: string; trigger?: { type?: string } }[]).map((a, i) => (
            <div key={i} className="text-xs p-2 border rounded bg-muted/50">
              <span className="font-medium capitalize">{a.trigger?.type?.replace(/_/g, " ") ?? "—"}</span>
              {a.display_text && <p className="text-muted-foreground mt-0.5">{a.display_text}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

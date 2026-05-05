"use client";

import { cn } from "@/lib/utils";
import { createContext, useContext, useState, forwardRef } from "react";
import { X } from "lucide-react";

// ─── Traits context ───────────────────────────────────────────────────────────

export type TraitEntry = { slug: string; display_name: string };

const TraitsContext = createContext<TraitEntry[]>([]);

export function TraitsProvider({ traits, children }: { traits: TraitEntry[]; children: React.ReactNode }) {
  return <TraitsContext.Provider value={traits}>{children}</TraitsContext.Provider>;
}

export function useTraits() {
  return useContext(TraitsContext);
}

// ─── TraitPicker ─────────────────────────────────────────────────────────────

export function TraitPicker({
  value,
  onChange,
  placeholder = "Search traits…",
}: {
  value: string[];
  onChange: (slugs: string[]) => void;
  placeholder?: string;
}) {
  const traits = useTraits();
  const [input, setInput] = useState("");

  const available = traits.filter((t) => !value.includes(t.slug));
  const filtered = input
    ? available.filter(
        (t) =>
          t.slug.includes(input.toLowerCase()) ||
          t.display_name.toLowerCase().includes(input.toLowerCase())
      )
    : available;

  function add(slug: string) {
    if (!slug || value.includes(slug)) return;
    onChange([...value, slug]);
    setInput("");
  }

  function remove(slug: string) {
    onChange(value.filter((s) => s !== slug));
  }

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((slug) => {
            const trait = traits.find((t) => t.slug === slug);
            return (
              <span key={slug} className="flex items-center gap-1 px-1.5 py-0.5 bg-secondary rounded text-xs">
                {trait?.display_name ?? slug}
                <button type="button" onClick={() => remove(slug)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filtered.length > 0) {
                add(filtered[0]!.slug);
              } else if (input.trim()) {
                add(input.trim().toLowerCase().replace(/\s+/g, "_"));
              }
            }
          }}
          placeholder={placeholder}
          className="input text-sm w-full"
        />
        {input && filtered.length > 0 && (
          <div className="absolute z-20 mt-1 w-full border rounded-md bg-popover shadow-md max-h-40 overflow-y-auto">
            {filtered.slice(0, 15).map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => add(t.slug)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent"
              >
                <span className="font-medium">{t.display_name}</span>
                <span className="ml-1.5 text-muted-foreground">{t.slug}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <FieldError message={error} />}
    </div>
  );
}

export function FieldError({ message }: { message: string }) {
  return <p className="text-xs text-destructive">{message}</p>;
}

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring capitalize",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

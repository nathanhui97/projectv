"use client";

// FilterBuilder works with the shorthand filter format:
// { side: "enemy", type: "unit", max_level: 5, name_is: "Zaku II", has_keyword: ["blocker"] }
// All keys are ANDed together. normalizeFilter() converts to FilterSchema on save.
import type { ShorthandFilter } from "@project-v/schemas";
export type { ShorthandFilter };

interface FilterBuilderProps {
  filter: ShorthandFilter;
  onChange: (f: ShorthandFilter) => void;
  label?: string;
}

function set<K extends keyof ShorthandFilter>(
  f: ShorthandFilter,
  key: K,
  value: ShorthandFilter[K]
): ShorthandFilter {
  const next = { ...f };
  if (value === undefined || (value as unknown) === "" || value === false) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

const KEYWORDS = [
  "blocker", "breach", "first_strike", "high_maneuver",
  "repair", "suppression", "support",
] as const;

const ZONES = [
  { value: "battle_area",   label: "Battle area" },
  { value: "hand",          label: "Hand" },
  { value: "deck",          label: "Deck" },
  { value: "trash",         label: "Trash" },
  { value: "resource_area", label: "Resource area" },
  { value: "shield_area",   label: "Shield area" },
] as const;

export default function FilterBuilder({ filter, onChange, label = "Filter" }: FilterBuilderProps) {
  const f = filter;

  return (
    <div className="border rounded-md p-3 space-y-3 bg-muted/20">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>

      {/* Row 1: side + type + color */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Side</label>
          <select
            value={f.side ?? ""}
            onChange={(e) => onChange(set(f, "side", e.target.value as ShorthandFilter["side"] || undefined))}
            className="input text-sm w-full"
          >
            <option value="">Any side</option>
            <option value="friendly">Friendly</option>
            <option value="enemy">Enemy</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Type</label>
          <select
            value={f.type ?? ""}
            onChange={(e) => onChange(set(f, "type", e.target.value as ShorthandFilter["type"] || undefined))}
            className="input text-sm w-full"
          >
            <option value="">Any type</option>
            <option value="unit">Unit</option>
            <option value="pilot">Pilot</option>
            <option value="command">Command</option>
            <option value="base">Base</option>
            <option value="token">Token</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Color</label>
          <select
            value={f.color ?? ""}
            onChange={(e) => onChange(set(f, "color", e.target.value as ShorthandFilter["color"] || undefined))}
            className="input text-sm w-full"
          >
            <option value="">Any color</option>
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="red">Red</option>
            <option value="white">White</option>
            <option value="purple">Purple</option>
          </select>
        </div>
      </div>

      {/* Row 2: zone + name */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Zone (card is in)</label>
          <select
            value={f.zone ?? ""}
            onChange={(e) => onChange(set(f, "zone", e.target.value || undefined))}
            className="input text-sm w-full"
          >
            <option value="">Any zone</option>
            {ZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Name is (exact)</label>
          <input
            value={f.name_is ?? ""}
            onChange={(e) => onChange(set(f, "name_is", e.target.value || undefined))}
            placeholder="e.g. Zaku II"
            className="input text-sm w-full"
          />
        </div>
      </div>

      {/* Row 3: name_includes + traits */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Name includes</label>
          <input
            value={f.name_includes ?? ""}
            onChange={(e) => onChange(set(f, "name_includes", e.target.value || undefined))}
            placeholder="e.g. Gundam"
            className="input text-sm w-full"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Traits (ALL must match, comma-separated)</label>
          <input
            value={f.traits?.join(", ") ?? ""}
            onChange={(e) => onChange(set(f, "traits",
              e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined
            ))}
            placeholder="e.g. Zeon, Newtype"
            className="input text-sm w-full"
          />
        </div>
      </div>

      {/* Row 4: stat limits */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Min Level</label>
          <input type="number" min={1} value={f.min_level ?? ""} onChange={(e) => onChange(set(f, "min_level", e.target.value ? Number(e.target.value) : undefined))} className="input text-sm w-full" placeholder="—" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Max Level</label>
          <input type="number" min={1} value={f.max_level ?? ""} onChange={(e) => onChange(set(f, "max_level", e.target.value ? Number(e.target.value) : undefined))} className="input text-sm w-full" placeholder="—" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Min Cost</label>
          <input type="number" min={0} value={f.min_cost ?? ""} onChange={(e) => onChange(set(f, "min_cost", e.target.value ? Number(e.target.value) : undefined))} className="input text-sm w-full" placeholder="—" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Max Cost</label>
          <input type="number" min={0} value={f.max_cost ?? ""} onChange={(e) => onChange(set(f, "max_cost", e.target.value ? Number(e.target.value) : undefined))} className="input text-sm w-full" placeholder="—" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Min HP</label>
          <input type="number" min={1} value={f.min_hp ?? ""} onChange={(e) => onChange(set(f, "min_hp", e.target.value ? Number(e.target.value) : undefined))} className="input text-sm w-full" placeholder="—" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Max HP</label>
          <input type="number" min={1} value={f.max_hp ?? ""} onChange={(e) => onChange(set(f, "max_hp", e.target.value ? Number(e.target.value) : undefined))} className="input text-sm w-full" placeholder="—" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Min AP</label>
          <input type="number" min={0} value={f.min_ap ?? ""} onChange={(e) => onChange(set(f, "min_ap", e.target.value ? Number(e.target.value) : undefined))} className="input text-sm w-full" placeholder="—" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Max AP</label>
          <input type="number" min={0} value={f.max_ap ?? ""} onChange={(e) => onChange(set(f, "max_ap", e.target.value ? Number(e.target.value) : undefined))} className="input text-sm w-full" placeholder="—" />
        </div>
      </div>

      {/* Row 5: has_keyword */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Has keyword (ALL must match)</label>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {KEYWORDS.map((kw) => (
            <label key={kw} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={f.has_keyword?.includes(kw) ?? false}
                onChange={(e) => {
                  const current = f.has_keyword ?? [];
                  const next = e.target.checked
                    ? [...current, kw]
                    : current.filter((k) => k !== kw);
                  onChange(set(f, "has_keyword", next.length ? next : undefined));
                }}
              />
              {kw.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </div>

      {/* Row 6: boolean flags */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {([
          ["is_token",          "Is token"],
          ["rested",            "Is resting"],
          ["is_active",         "Is active (not resting)"],
          ["is_damaged",        "Is damaged"],
          ["is_paired",         "Is paired"],
          ["is_linked",         "Is linked"],
          ["not_self",          "Not self"],
          ["paired_with_source","Paired with source"],
        ] as [keyof ShorthandFilter, string][]).map(([key, lbl]) => (
          <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!f[key]}
              onChange={(e) => onChange(set(f, key, e.target.checked || undefined))}
            />
            {lbl}
          </label>
        ))}
      </div>
    </div>
  );
}

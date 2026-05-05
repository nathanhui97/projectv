"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Field, Select } from "./FormPrimitives";
import FilterBuilder, { type ShorthandFilter } from "./FilterBuilder";

type Condition = Record<string, unknown>;

const CONDITION_TYPES = [
  // Simple boolean
  { value: "is_my_turn",       label: "Is my turn" },
  { value: "is_opponent_turn", label: "Is opponent's turn" },
  { value: "coin_flip",        label: "Coin flip (50/50)" },
  // Card presence
  { value: "count",            label: "Count matching cards..." },
  { value: "has_card",         label: "Has a card matching..." },
  { value: "no_card",          label: "No card matching..." },
  { value: "zone_count",       label: "Zone count..." },
  // Player state
  { value: "resource_count",   label: "Resource count" },
  { value: "hand_size",        label: "Hand size" },
  { value: "deck_size",        label: "Deck size" },
  { value: "shields_remaining",label: "Shields remaining" },
  { value: "player_level",     label: "Player level" },
  // Other
  { value: "phase_is",         label: "Phase is..." },
  { value: "compare_stat",     label: "Compare stat" },
  { value: "dice_roll",        label: "Dice roll" },
  { value: "controller_chose", label: "Controller chose..." },
  // Compound
  { value: "and",              label: "AND — all of..." },
  { value: "or",               label: "OR — any of..." },
  { value: "not",              label: "NOT — negate..." },
] as const;

const OPS   = ["=", "!=", "<", ">", "<=", ">="] as const;
const ZONES = ["hand", "deck", "trash", "shield_area"] as const;
const PHASES = ["start", "draw", "resource", "main", "end"] as const;
const STATS  = ["ap", "hp", "level"] as const;

function getConditionType(c: Condition): string {
  if ("and" in c) return "and";
  if ("or"  in c) return "or";
  if ("not" in c) return "not";
  return (c.type as string) ?? "is_my_turn";
}

function defaultCondition(type: string): Condition {
  switch (type) {
    case "count":             return { type, filter: {}, op: ">=", value: 1 };
    case "has_card":          return { type, filter: {} };
    case "no_card":           return { type, filter: {} };
    case "zone_count":        return { type, side: "friendly", zone: "hand", op: ">=", value: 1 };
    case "resource_count":    return { type, op: ">=", value: 1 };
    case "hand_size":         return { type, side: "friendly", op: ">=", value: 1 };
    case "deck_size":         return { type, side: "friendly", op: ">=", value: 1 };
    case "shields_remaining": return { type, side: "friendly", op: ">=", value: 1 };
    case "player_level":      return { type, side: "friendly", op: ">=", value: 1 };
    case "phase_is":          return { type, phase: "main" };
    case "compare_stat":      return { type, lhs: { target: "$self", stat: "ap" }, rhs: 0, op: ">=" };
    case "dice_roll":         return { type, sides: 6, op: ">=", value: 4 };
    case "controller_chose":  return { type, step_ref: "$choice", value: "" };
    case "and":               return { and: [] };
    case "or":                return { or: [] };
    case "not":               return { not: { type: "is_my_turn" } };
    default:                  return { type };
  }
}

function OpSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {OPS.map((op) => <option key={op} value={op}>{op}</option>)}
    </Select>
  );
}

function SideSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="friendly">Friendly</option>
      <option value="enemy">Enemy</option>
    </Select>
  );
}

function SideOpValue({ cond, set }: { cond: Condition; set: (k: string, v: unknown) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Field label="Side">
        <SideSelect value={(cond.side as string) ?? "friendly"} onChange={(v) => set("side", v)} />
      </Field>
      <Field label="Op">
        <OpSelect value={(cond.op as string) ?? ">="} onChange={(v) => set("op", v)} />
      </Field>
      <Field label="Value">
        <input
          type="number"
          className="input text-sm w-full"
          value={(cond.value as number) ?? 1}
          onChange={(e) => set("value", Number(e.target.value))}
        />
      </Field>
    </div>
  );
}

// ─── Type-specific fields ─────────────────────────────────────────────────────

function ConditionFields({
  cond, set, depth,
}: {
  cond: Condition;
  set: (k: string, v: unknown) => void;
  depth: number;
}) {
  const type = getConditionType(cond);

  switch (type) {

    case "is_my_turn":
    case "is_opponent_turn":
    case "coin_flip":
      return <p className="text-xs text-muted-foreground italic">No additional fields required.</p>;

    case "count":
      return (
        <>
          <FilterBuilder
            filter={(cond.filter as ShorthandFilter) ?? {}}
            onChange={(f) => set("filter", f)}
            label="Count cards matching"
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Op"><OpSelect value={(cond.op as string) ?? ">="} onChange={(v) => set("op", v)} /></Field>
            <Field label="Value">
              <input type="number" className="input text-sm w-full" value={(cond.value as number) ?? 1} onChange={(e) => set("value", Number(e.target.value))} />
            </Field>
          </div>
        </>
      );

    case "has_card":
    case "no_card":
      return (
        <FilterBuilder
          filter={(cond.filter as ShorthandFilter) ?? {}}
          onChange={(f) => set("filter", f)}
          label={type === "has_card" ? "At least one card matching" : "No card matching"}
        />
      );

    case "zone_count":
      return (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Side"><SideSelect value={(cond.side as string) ?? "friendly"} onChange={(v) => set("side", v)} /></Field>
            <Field label="Zone">
              <Select value={(cond.zone as string) ?? "hand"} onChange={(e) => set("zone", e.target.value)}>
                {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
              </Select>
            </Field>
          </div>
          <FilterBuilder
            filter={(cond.filter as ShorthandFilter) ?? {}}
            onChange={(f) => set("filter", Object.keys(f).length ? f : undefined)}
            label="Filter (optional)"
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Op"><OpSelect value={(cond.op as string) ?? ">="} onChange={(v) => set("op", v)} /></Field>
            <Field label="Value">
              <input type="number" className="input text-sm w-full" value={(cond.value as number) ?? 1} onChange={(e) => set("value", Number(e.target.value))} />
            </Field>
          </div>
        </>
      );

    case "resource_count":
      return (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Op"><OpSelect value={(cond.op as string) ?? ">="} onChange={(v) => set("op", v)} /></Field>
            <Field label="Value">
              <input type="number" className="input text-sm w-full" value={(cond.value as number) ?? 1} onChange={(e) => set("value", Number(e.target.value))} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!cond.active_only}
              onChange={(e) => set("active_only", e.target.checked || undefined)}
            />
            Active (unrested) resources only
          </label>
        </>
      );

    case "hand_size":
    case "deck_size":
    case "shields_remaining":
    case "player_level":
      return <SideOpValue cond={cond} set={set} />;

    case "phase_is":
      return (
        <Field label="Phase">
          <Select value={(cond.phase as string) ?? "main"} onChange={(e) => set("phase", e.target.value)}>
            {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
      );

    case "dice_roll":
      return (
        <div className="grid grid-cols-3 gap-2">
          <Field label="d? sides">
            <input type="number" min={2} className="input text-sm w-full" value={(cond.sides as number) ?? 6} onChange={(e) => set("sides", Number(e.target.value))} />
          </Field>
          <Field label="Op"><OpSelect value={(cond.op as string) ?? ">="} onChange={(v) => set("op", v)} /></Field>
          <Field label="Value">
            <input type="number" className="input text-sm w-full" value={(cond.value as number) ?? 4} onChange={(e) => set("value", Number(e.target.value))} />
          </Field>
        </div>
      );

    case "controller_chose":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Step ref ($var)">
            <input className="input text-sm w-full" value={(cond.step_ref as string) ?? ""} onChange={(e) => set("step_ref", e.target.value)} placeholder="$choice" />
          </Field>
          <Field label="Equals value">
            <input className="input text-sm w-full" value={(cond.value as string) ?? ""} onChange={(e) => set("value", e.target.value)} placeholder="yes" />
          </Field>
        </div>
      );

    case "compare_stat": {
      const lhs = (cond.lhs as Record<string, unknown>) ?? { target: "$self", stat: "ap" };
      const rhsIsObj = typeof cond.rhs === "object" && cond.rhs !== null;
      const rhs = rhsIsObj ? (cond.rhs as Record<string, unknown>) : {};
      return (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="LHS target ($var)">
              <input className="input text-sm w-full" value={(lhs.target as string) ?? ""} onChange={(e) => set("lhs", { ...lhs, target: e.target.value })} placeholder="$self" />
            </Field>
            <Field label="LHS stat">
              <Select value={(lhs.stat as string) ?? "ap"} onChange={(e) => set("lhs", { ...lhs, stat: e.target.value })}>
                {STATS.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Op"><OpSelect value={(cond.op as string) ?? ">="} onChange={(v) => set("op", v)} /></Field>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={rhsIsObj}
              onChange={(e) => set("rhs", e.target.checked ? { target: "$target", stat: "ap" } : 0)}
            />
            RHS is another card's stat (uncheck = fixed number)
          </label>
          {rhsIsObj ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="RHS target ($var)">
                <input className="input text-sm w-full" value={(rhs.target as string) ?? ""} onChange={(e) => set("rhs", { ...rhs, target: e.target.value })} placeholder="$target" />
              </Field>
              <Field label="RHS stat">
                <Select value={(rhs.stat as string) ?? "ap"} onChange={(e) => set("rhs", { ...rhs, stat: e.target.value })}>
                  {STATS.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </Select>
              </Field>
            </div>
          ) : (
            <Field label="RHS fixed value">
              <input type="number" className="input text-sm w-full" value={(cond.rhs as number) ?? 0} onChange={(e) => set("rhs", Number(e.target.value))} />
            </Field>
          )}
        </>
      );
    }

    case "and":
    case "or": {
      if (depth >= 2) {
        return <p className="text-xs text-muted-foreground italic">Max nesting depth — use JSON view for deeper conditions.</p>;
      }
      const key = type as "and" | "or";
      const children = (cond[key] as Condition[]) ?? [];
      return (
        <div className="space-y-2 pl-2 border-l">
          {children.map((child, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1">
                <ConditionEditor
                  condition={child}
                  onChange={(next) => {
                    const updated = next
                      ? children.map((c, idx) => idx === i ? next : c)
                      : children.filter((_, idx) => idx !== i);
                    set(key, updated);
                  }}
                  depth={depth + 1}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set(key, [...children, { type: "is_my_turn" }])}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add clause
          </button>
        </div>
      );
    }

    case "not": {
      if (depth >= 2) {
        return <p className="text-xs text-muted-foreground italic">Max nesting depth — use JSON view for deeper conditions.</p>;
      }
      return (
        <ConditionEditor
          condition={(cond.not as Condition) ?? { type: "is_my_turn" }}
          onChange={(next) => set("not", next ?? { type: "is_my_turn" })}
          depth={depth + 1}
        />
      );
    }

    default:
      return <p className="text-xs text-muted-foreground italic">Unknown condition type.</p>;
  }
}

// ─── Public component ─────────────────────────────────────────────────────────

export function ConditionEditor({
  condition,
  onChange,
  depth = 0,
}: {
  condition: Condition | undefined;
  onChange: (c: Condition | undefined) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0 ? false : true);
  const condType = condition ? getConditionType(condition) : null;

  function setField(k: string, v: unknown) {
    if (!condition) return;
    onChange({ ...condition, [k]: v });
  }

  if (!condition) {
    return (
      <button
        type="button"
        onClick={() => { onChange({ type: "is_my_turn" }); setExpanded(true); }}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Add condition
      </button>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden bg-amber-50/30 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/30">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100/40 dark:bg-amber-900/20 select-none">
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <span className="text-xs font-mono text-muted-foreground">if</span>
        <span className="text-xs bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded font-mono text-amber-800 dark:text-amber-200">
          {condType}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          <Field label="Condition type">
            <Select
              value={condType ?? "is_my_turn"}
              onChange={(e) => onChange(defaultCondition(e.target.value))}
            >
              {CONDITION_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </Select>
          </Field>
          <ConditionFields cond={condition} set={setField} depth={depth} />
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import FilterBuilder, { type ShorthandFilter } from "./FilterBuilder";
import { Field, Select } from "./FormPrimitives";
import { ConditionEditor } from "./ConditionEditor";

// ─── Action types ─────────────────────────────────────────────────────────────

const ACTION_TYPES = [
  // Targeting
  "choose_target",
  "all_matching",
  "count_zone",
  // Card movement
  "move_to_hand",
  "move_to_deck_top",
  "move_to_deck_bottom",
  "move_to_trash",
  "move_to_resource",
  "move_to_shield",
  "discard",
  "discard_from_hand",
  "exile",
  "mill",
  "deploy_card",
  "look_at",
  // Pairing
  "pair_pilot",
  // Damage & combat
  "deal_damage",
  "prevent_damage",
  "destroy",
  "heal",
  "grant_taunt",
  "change_attack_target",
  "prevent_ready",
  // Stat & ability modification
  "modify_stat",
  "set_stat",
  "modify_cost",
  "gain_keyword",
  "lose_keyword",
  "gain_traits",
  "copy_abilities",
  // Counters
  "add_counter",
  "remove_counter",
  // State changes
  "rest",
  "ready",
  // Resources
  "draw",
  "add_ex_resource",
  // Deck manipulation
  "search_deck",
  "peek_top",
  "shuffle",
  "reveal",
  // Tokens
  "create_token",
  // Prompts
  "prompt_yes_no",
  "prompt_choice",
  "prompt_number",
  // Misc
  "manual_resolve",
] as const;

type Step = Record<string, unknown>;

function defaultStep(action: string): Step {
  switch (action) {
    case "choose_target": return { action, filter: {}, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" };
    case "all_matching":  return { action, filter: {}, store_as: "$targets" };
    case "deal_damage":   return { action, target: "$target", amount: 1, damage_type: "effect" };
    case "modify_stat":   return { action, target: "$target", stat: "ap", amount: -1, duration: "end_of_turn" };
    case "gain_keyword":  return { action, target: "$target", keywords: [{ keyword: "blocker" }], duration: "end_of_turn" };
    case "draw":          return { action, side: "friendly", amount: 1 };
    case "heal":          return { action, target: "$target", amount: 1 };
    case "destroy":              return { action, target: "$target" };
    case "rest":                 return { action, target: "$target" };
    case "ready":                return { action, target: "$target" };
    case "move_to_hand":         return { action, target: "$target" };
    case "move_to_deck_top":     return { action, target: "$target" };
    case "move_to_deck_bottom":  return { action, target: "$target" };
    case "move_to_trash":        return { action, target: "$target" };
    case "move_to_resource":     return { action, target: "$target", rest_state: "rested" };
    case "move_to_shield":       return { action, target: "$target" };
    case "discard":              return { action, target: "$target" };
    case "discard_from_hand":    return { action, side: "enemy", amount: 1, selector: "controller_chooses" };
    case "exile":                return { action, target: "$target" };
    case "mill":                 return { action, target: "$target" };
    case "look_at":              return { action, target: "$target", reveal_to: "controller" };
    case "pair_pilot":           return { action, pilot: "$pilot", unit: "$unit" };
    case "prevent_damage":       return { action, target: "$target", amount: 1, duration: "end_of_turn" };
    case "set_stat":             return { action, target: "$target", stat: "ap", value: 1, duration: "end_of_turn" };
    case "lose_keyword":         return { action, target: "$target", keywords: ["blocker"], duration: "end_of_turn" };
    case "gain_traits":          return { action, target: "$target", traits: [], duration: "end_of_turn" };
    case "copy_abilities":       return { action, target: "$target", source: "$source", duration: "end_of_turn" };
    case "add_counter":          return { action, target: "$target", counter_name: "charge", amount: 1 };
    case "remove_counter":       return { action, target: "$target", counter_name: "charge", amount: 1 };
    case "prompt_number":        return { action, prompt: "Choose a number:", min: 1, max: 5, store_as: "$n" };
    case "peek_top":          return { action, side: "friendly", count: 1, reveal_to: "controller", store_as: "$peeked" };
    case "search_deck":       return { action, side: "friendly", filter: {}, count: 1, reveal: "private", store_as: "$found" };
    case "deploy_card":       return { action, target: "$target", pay_cost: false };
    case "create_token":      return { action, token_id: "", count: 1, side: "friendly", rest_state: "rested" };
    case "grant_taunt":       return { action, target: "$target", duration: "end_of_turn" };
    case "change_attack_target": return { action, new_target: "$target" };
    case "prevent_ready":     return { action, target: "$target", duration: "end_of_turn" };
    case "modify_cost":       return { action, target: "$target", amount: -1, duration: "end_of_turn" };
    case "add_ex_resource":   return { action, side: "friendly", amount: 1 };
    case "count_zone":        return { action, side: "friendly", zone: "hand", store_as: "$count" };
    case "prompt_yes_no":     return { action, prompt: "Do you want to…?", store_as: "$choice", on_yes: [], on_no: [] };
    case "prompt_choice":     return { action, prompt: "Choose one:", store_as: "$choice", options: [] };
    case "shuffle":           return { action, side: "friendly", zone: "deck" };
    case "reveal":            return { action, target: "$target", to: "all" };
    case "manual_resolve":    return { action, prompt_text: "Resolve this effect manually." };
    default:                  return { action };
  }
}

// ─── StepList — public entry point ───────────────────────────────────────────

export function StepList({
  steps,
  onChange,
  depth = 0,
}: {
  steps: unknown[];
  onChange: (v: unknown[]) => void;
  depth?: number;
}) {
  const list = (steps ?? []) as Step[];

  function addStep() {
    onChange([...list, defaultStep("choose_target")]);
  }

  function removeStep(i: number) {
    onChange(list.filter((_, idx) => idx !== i));
  }

  function updateStep(i: number, next: Step) {
    onChange(list.map((s, idx) => (idx === i ? next : s)));
  }

  function moveUp(i: number) {
    const next = [...list];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  }

  function moveDown(i: number) {
    const next = [...list];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  }

  return (
    <div className={depth > 0 ? "pl-3 border-l space-y-2" : "space-y-2"}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Steps ({list.length})
        </p>
        <button
          type="button"
          onClick={addStep}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add Step
        </button>
      </div>

      {list.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-3 border rounded-md border-dashed">
          No steps yet.
        </p>
      )}

      {list.map((step, i) => (
        <StepItem
          key={i}
          index={i}
          step={step}
          depth={depth}
          onUpdate={(next) => updateStep(i, next)}
          onRemove={() => removeStep(i)}
          onMoveUp={i > 0 ? () => moveUp(i) : undefined}
          onMoveDown={i < list.length - 1 ? () => moveDown(i) : undefined}
        />
      ))}
    </div>
  );
}

// ─── Single step wrapper ──────────────────────────────────────────────────────

function StepItem({
  index, step, depth, onUpdate, onRemove, onMoveUp, onMoveDown,
}: {
  index: number;
  step: Step;
  depth: number;
  onUpdate: (s: Step) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const action = (step.action as string) ?? "choose_target";

  function changeAction(newAction: string) {
    onUpdate(defaultStep(newAction));
  }

  function set(key: string, value: unknown) {
    if (value === undefined || value === "") {
      const next = { ...step };
      delete next[key];
      onUpdate(next);
    } else {
      onUpdate({ ...step, [key]: value });
    }
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 select-none">
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <span className="text-xs text-muted-foreground font-mono">Step {index + 1}</span>
        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">{action}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {onMoveUp && (
            <button type="button" onClick={onMoveUp} className="text-muted-foreground hover:text-foreground text-xs px-1">↑</button>
          )}
          {onMoveDown && (
            <button type="button" onClick={onMoveDown} className="text-muted-foreground hover:text-foreground text-xs px-1">↓</button>
          )}
          <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive ml-1">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          <Field label="Action">
            <Select value={action} onChange={(e) => changeAction(e.target.value)}>
              {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </Field>
          <StepFields action={action} step={step} set={set} onUpdate={onUpdate} depth={depth} />
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Condition (optional)</p>
            <ConditionEditor
              condition={step.condition as Record<string, unknown> | undefined}
              onChange={(c) => set("condition", c)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action-specific fields ───────────────────────────────────────────────────

// Target / store_as text input — accepts $variable names (e.g. $target, $self, $paired_pilot)
// For filter-object targets, switch to JSON view.
function TargetInput({ value, onChange, placeholder = "$target" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="input text-sm w-full"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

// Alias used for store_as fields to make intent clear at call sites
const StoreAsInput = TargetInput;

function SideSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="friendly">Friendly (controller)</option>
      <option value="enemy">Enemy (opponent)</option>
      <option value="any">Any (both)</option>
    </Select>
  );
}

const KEYWORDS = [
  "blocker", "breach", "first_strike", "high_maneuver",
  "repair", "suppression", "support",
] as const;

function KeywordPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(kw: string) {
    onChange(selected.includes(kw) ? selected.filter((k) => k !== kw) : [...selected, kw]);
  }
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 border rounded-md p-2 bg-muted/20">
      {KEYWORDS.map((kw) => (
        <label key={kw} className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={selected.includes(kw)} onChange={() => toggle(kw)} />
          {kw.replace(/_/g, " ")}
        </label>
      ))}
    </div>
  );
}

function DurationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="end_of_turn">End of turn</option>
      <option value="end_of_opponent_turn">End of opponent's turn</option>
      <option value="end_of_battle">End of battle</option>
      <option value="until_end_of_phase">Until end of phase</option>
      <option value="permanent">Permanent</option>
      <option value="while_paired">While paired</option>
      <option value="while_linked">While linked</option>
      <option value="while_in_zone">While in zone</option>
      <option value="until_destroyed">Until destroyed</option>
    </Select>
  );
}

function StepFields({
  action, step, set, onUpdate, depth,
}: {
  action: string;
  step: Step;
  set: (k: string, v: unknown) => void;
  onUpdate: (s: Step) => void;
  depth: number;
}) {
  switch (action) {

    case "choose_target":
      return (
        <>
          <FilterBuilder
            filter={(step.filter as ShorthandFilter) ?? {}}
            onChange={(f) => set("filter", f)}
            label="Target Filter"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Selector">
              <Select value={(step.selector as string) ?? "controller_chooses"} onChange={(e) => set("selector", e.target.value)}>
                <option value="controller_chooses">Controller chooses</option>
                <option value="opponent_chooses">Opponent chooses</option>
                <option value="random">Random</option>
              </Select>
            </Field>
            <Field label="Store as">
              <StoreAsInput value={(step.store_as as string) ?? ""} onChange={(v) => set("store_as", v)} placeholder="$target" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min targets (0 = optional)">
              <input type="number" min={0} className="input text-sm w-full" value={(step.min as number) ?? 1} onChange={(e) => set("min", Number(e.target.value))} />
            </Field>
            <Field label="Max targets">
              <input type="number" min={1} className="input text-sm w-full" value={(step.max as number) ?? 1} onChange={(e) => set("max", Number(e.target.value))} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!step.optional}
              onChange={(e) => set("optional", e.target.checked || undefined)}
            />
            Optional (player may skip this choice)
          </label>
        </>
      );

    case "all_matching":
      return (
        <>
          <FilterBuilder
            filter={(step.filter as ShorthandFilter) ?? {}}
            onChange={(f) => set("filter", f)}
            label="Match Filter"
          />
          <Field label="Store as">
            <StoreAsInput value={(step.store_as as string) ?? ""} onChange={(v) => set("store_as", v)} placeholder="$targets" />
          </Field>
        </>
      );

    case "deal_damage":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target ($var)">
              <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
            </Field>
            <Field label="Amount">
              <input type="number" min={0} className="input text-sm w-full" value={(step.amount as number) ?? 1} onChange={(e) => set("amount", Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Damage type">
            <Select value={(step.damage_type as string) ?? "effect"} onChange={(e) => set("damage_type", e.target.value)}>
              <option value="effect">Effect</option>
              <option value="battle">Battle</option>
            </Select>
          </Field>
        </>
      );

    case "modify_stat":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target ($var)">
              <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
            </Field>
            <Field label="Stat">
              <Select value={(step.stat as string) ?? "ap"} onChange={(e) => set("stat", e.target.value)}>
                <option value="ap">AP</option>
                <option value="hp">HP</option>
                <option value="level">Level</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (negative = reduce)">
              <input type="number" className="input text-sm w-full" value={(step.amount as number) ?? 0} onChange={(e) => set("amount", Number(e.target.value))} />
            </Field>
            <Field label="Duration">
              <DurationSelect value={(step.duration as string) ?? "end_of_turn"} onChange={(v) => set("duration", v)} />
            </Field>
          </div>
        </>
      );

    case "gain_keyword": {
      const gainKws = ((step.keywords as { keyword: string }[]) ?? []).map((k) => k.keyword);
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target ($var)">
              <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
            </Field>
            <Field label="Duration">
              <DurationSelect value={(step.duration as string) ?? "end_of_turn"} onChange={(v) => set("duration", v)} />
            </Field>
          </div>
          <Field label="Keywords to gain">
            <KeywordPicker
              selected={gainKws}
              onChange={(kws) => set("keywords", kws.map((kw) => ({ keyword: kw })))}
            />
          </Field>
        </>
      );
    }

    case "heal":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target ($var)">
            <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
          </Field>
          <Field label="Amount">
            <input type="number" min={1} className="input text-sm w-full" value={(step.amount as number) ?? 1} onChange={(e) => set("amount", Number(e.target.value))} />
          </Field>
        </div>
      );

    case "destroy":
    case "rest":
    case "ready":
    case "exile":
    case "mill":
    case "move_to_hand":
    case "move_to_deck_top":
    case "move_to_deck_bottom":
    case "move_to_trash":
    case "move_to_shield":
    case "discard":
      return (
        <Field label="Target ($var)">
          <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
        </Field>
      );

    case "move_to_resource":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target ($var)">
            <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
          </Field>
          <Field label="Rest state">
            <Select value={(step.rest_state as string) ?? "rested"} onChange={(e) => set("rest_state", e.target.value)}>
              <option value="rested">Rested</option>
              <option value="active">Active</option>
            </Select>
          </Field>
        </div>
      );

    case "look_at":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target ($var)">
            <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
          </Field>
          <Field label="Reveal to">
            <Select value={(step.reveal_to as string) ?? "controller"} onChange={(e) => set("reveal_to", e.target.value)}>
              <option value="controller">Controller only</option>
              <option value="opponent">Opponent only</option>
              <option value="all">All players</option>
            </Select>
          </Field>
        </div>
      );

    case "pair_pilot":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pilot ($var)">
            <TargetInput value={(step.pilot as string) ?? ""} onChange={(v) => set("pilot", v)} placeholder="$pilot" />
          </Field>
          <Field label="Unit ($var)">
            <TargetInput value={(step.unit as string) ?? ""} onChange={(v) => set("unit", v)} placeholder="$unit" />
          </Field>
        </div>
      );

    case "prevent_damage":
      return (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Target ($var)">
            <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
          </Field>
          <Field label="Amount">
            <input type="number" min={0} className="input text-sm w-full" value={(step.amount as number) ?? 1} onChange={(e) => set("amount", Number(e.target.value))} />
          </Field>
          <Field label="Duration">
            <DurationSelect value={(step.duration as string) ?? "end_of_turn"} onChange={(v) => set("duration", v)} />
          </Field>
        </div>
      );

    case "set_stat":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target ($var)">
              <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
            </Field>
            <Field label="Stat">
              <Select value={(step.stat as string) ?? "ap"} onChange={(e) => set("stat", e.target.value)}>
                <option value="ap">AP</option>
                <option value="hp">HP</option>
                <option value="level">Level</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Set to value">
              <input type="number" className="input text-sm w-full" value={(step.value as number) ?? 1} onChange={(e) => set("value", Number(e.target.value))} />
            </Field>
            <Field label="Duration">
              <DurationSelect value={(step.duration as string) ?? "end_of_turn"} onChange={(v) => set("duration", v)} />
            </Field>
          </div>
        </>
      );

    case "lose_keyword": {
      const loseKws = (step.keywords as string[]) ?? [];
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target ($var)">
              <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
            </Field>
            <Field label="Duration">
              <DurationSelect value={(step.duration as string) ?? "end_of_turn"} onChange={(v) => set("duration", v)} />
            </Field>
          </div>
          <Field label="Keywords to remove">
            <KeywordPicker selected={loseKws} onChange={(kws) => set("keywords", kws)} />
          </Field>
        </>
      );
    }

    case "gain_traits":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target ($var)">
              <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
            </Field>
            <Field label="Duration">
              <DurationSelect value={(step.duration as string) ?? "end_of_turn"} onChange={(v) => set("duration", v)} />
            </Field>
          </div>
          <Field label="Traits to add (comma-separated)">
            <input
              className="input text-sm w-full"
              value={(step.traits as string[])?.join(", ") ?? ""}
              onChange={(e) => set("traits", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              placeholder="Zeon, Newtype"
            />
          </Field>
        </>
      );

    case "copy_abilities":
      return (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Target ($var)">
            <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
          </Field>
          <Field label="Copy from ($var)">
            <TargetInput value={(step.source as string) ?? ""} onChange={(v) => set("source", v)} placeholder="$source" />
          </Field>
          <Field label="Duration">
            <DurationSelect value={(step.duration as string) ?? "end_of_turn"} onChange={(v) => set("duration", v)} />
          </Field>
        </div>
      );

    case "add_counter":
      return (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Target ($var)">
            <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
          </Field>
          <Field label="Counter name">
            <input className="input text-sm w-full" value={(step.counter_name as string) ?? ""} onChange={(e) => set("counter_name", e.target.value)} placeholder="charge" />
          </Field>
          <Field label="Amount">
            <input type="number" min={1} className="input text-sm w-full" value={(step.amount as number) ?? 1} onChange={(e) => set("amount", Number(e.target.value))} />
          </Field>
        </div>
      );

    case "remove_counter":
      return (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Target ($var)">
              <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
            </Field>
            <Field label="Counter name">
              <input className="input text-sm w-full" value={(step.counter_name as string) ?? ""} onChange={(e) => set("counter_name", e.target.value)} placeholder="charge" />
            </Field>
            <Field label="Amount">
              <input type="number" min={1} className="input text-sm w-full" value={(step.amount as number) ?? 1} onChange={(e) => set("amount", Number(e.target.value))} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={step.amount === "all"}
              onChange={(e) => set("amount", e.target.checked ? "all" : 1)}
            />
            Remove all counters
          </label>
        </>
      );

    case "prompt_number":
      return (
        <>
          <Field label="Prompt text">
            <input className="input text-sm w-full" value={(step.prompt as string) ?? ""} onChange={(e) => set("prompt", e.target.value)} placeholder="Choose a number:" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Min">
              <input type="number" className="input text-sm w-full" value={(step.min as number) ?? 1} onChange={(e) => set("min", Number(e.target.value))} />
            </Field>
            <Field label="Max">
              <input type="number" className="input text-sm w-full" value={(step.max as number) ?? 5} onChange={(e) => set("max", Number(e.target.value))} />
            </Field>
            <Field label="Store as">
              <StoreAsInput value={(step.store_as as string) ?? ""} onChange={(v) => set("store_as", v)} placeholder="$n" />
            </Field>
          </div>
        </>
      );

    case "deploy_card":
      return (
        <>
          <Field label="Target ($var)">
            <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
          </Field>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!step.pay_cost}
              onChange={(e) => set("pay_cost", e.target.checked || undefined)}
            />
            Pay cost (uncheck for burst / free deploys)
          </label>
        </>
      );

    case "grant_taunt":
    case "prevent_ready":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target ($var)">
            <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
          </Field>
          <Field label="Duration">
            <DurationSelect value={(step.duration as string) ?? "end_of_turn"} onChange={(v) => set("duration", v)} />
          </Field>
        </div>
      );

    case "change_attack_target":
      return (
        <Field label="New target ($var or filter)">
          <TargetInput value={(step.new_target as string) ?? ""} onChange={(v) => set("new_target", v)} />
        </Field>
      );

    case "modify_cost":
      return (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Target ($var)">
            <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
          </Field>
          <Field label="Amount (negative = reduce)">
            <input type="number" className="input text-sm w-full" value={(step.amount as number) ?? -1} onChange={(e) => set("amount", Number(e.target.value))} />
          </Field>
          <Field label="Duration">
            <DurationSelect value={(step.duration as string) ?? "end_of_turn"} onChange={(v) => set("duration", v)} />
          </Field>
        </div>
      );

    case "add_ex_resource":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Side">
            <SideSelect value={(step.side as string) ?? "controller"} onChange={(v) => set("side", v)} />
          </Field>
          <Field label="Amount">
            <input type="number" min={1} className="input text-sm w-full" value={(step.amount as number) ?? 1} onChange={(e) => set("amount", Number(e.target.value))} />
          </Field>
        </div>
      );

    case "count_zone":
      return (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Side">
              <SideSelect value={(step.side as string) ?? "controller"} onChange={(v) => set("side", v)} />
            </Field>
            <Field label="Zone">
              <Select value={(step.zone as string) ?? "hand"} onChange={(e) => set("zone", e.target.value)}>
                <option value="hand">Hand</option>
                <option value="deck">Deck</option>
                <option value="trash">Trash</option>
                <option value="battle_area">Battle area</option>
                <option value="resource_area">Resource area</option>
              </Select>
            </Field>
            <Field label="Store as">
              <StoreAsInput value={(step.store_as as string) ?? ""} onChange={(v) => set("store_as", v)} placeholder="$count" />
            </Field>
          </div>
          <FilterBuilder
            filter={(step.filter as ShorthandFilter) ?? {}}
            onChange={(f) => set("filter", Object.keys(f).length ? f : undefined)}
            label="Filter (optional)"
          />
        </>
      );

    case "discard_from_hand":
      return (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Side">
              <SideSelect value={(step.side as string) ?? "enemy"} onChange={(v) => set("side", v)} />
            </Field>
            <Field label="Amount">
              <input type="number" min={1} className="input text-sm w-full" value={(step.amount as number) ?? 1} onChange={(e) => set("amount", Number(e.target.value))} />
            </Field>
            <Field label="Selector">
              <Select value={(step.selector as string) ?? "controller_chooses"} onChange={(e) => set("selector", e.target.value)}>
                <option value="controller_chooses">Controller chooses</option>
                <option value="opponent_chooses">Opponent chooses</option>
                <option value="random">Random</option>
              </Select>
            </Field>
          </div>
        </>
      );

    case "draw":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Side">
            <SideSelect value={(step.side as string) ?? "controller"} onChange={(v) => set("side", v)} />
          </Field>
          <Field label="Amount">
            <input type="number" min={1} className="input text-sm w-full" value={(step.amount as number) ?? 1} onChange={(e) => set("amount", Number(e.target.value))} />
          </Field>
        </div>
      );

    case "search_deck":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Side">
              <SideSelect value={(step.side as string) ?? "friendly"} onChange={(v) => set("side", v)} />
            </Field>
            <Field label="Count">
              <input type="number" min={1} className="input text-sm w-full" value={(step.count as number) ?? 1} onChange={(e) => set("count", Number(e.target.value))} />
            </Field>
          </div>
          <FilterBuilder
            filter={(step.filter as ShorthandFilter) ?? {}}
            onChange={(f) => set("filter", f)}
            label="Search Filter"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reveal to">
              <Select value={(step.reveal as string) ?? "private"} onChange={(e) => set("reveal", e.target.value)}>
                <option value="private">Private (controller only)</option>
                <option value="all">All players</option>
              </Select>
            </Field>
            <Field label="Store as">
              <StoreAsInput value={(step.store_as as string) ?? ""} onChange={(v) => set("store_as", v)} placeholder="$found" />
            </Field>
          </div>
        </>
      );

    case "create_token": {
      const hasInline = !!(step.name || step.ap != null || step.hp != null);
      return (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Count">
              <input type="number" min={1} className="input text-sm w-full" value={(step.count as number) ?? 1} onChange={(e) => set("count", Number(e.target.value))} />
            </Field>
            <Field label="Side">
              <SideSelect value={(step.side as string) ?? "friendly"} onChange={(v) => set("side", v)} />
            </Field>
            <Field label="Rest state">
              <Select value={(step.rest_state as string) ?? "rested"} onChange={(e) => set("rest_state", e.target.value)}>
                <option value="rested">Rested</option>
                <option value="active">Active</option>
              </Select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={hasInline}
              onChange={(e) => {
                if (!e.target.checked) {
                  const next = { ...step };
                  delete next.name; delete next.ap; delete next.hp;
                  delete next.traits; delete next.keywords; delete next.color;
                  onUpdate(next);
                } else {
                  onUpdate({ ...step, name: "", ap: 1, hp: 1 });
                }
              }}
            />
            Define token inline (no registry ID)
          </label>

          {hasInline ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Token name">
                  <input className="input text-sm w-full" value={(step.name as string) ?? ""} onChange={(e) => set("name", e.target.value || undefined)} placeholder="e.g. Zaku II" />
                </Field>
                <Field label="AP">
                  <input type="number" min={0} className="input text-sm w-full" value={(step.ap as number) ?? 1} onChange={(e) => set("ap", Number(e.target.value))} />
                </Field>
                <Field label="HP">
                  <input type="number" min={0} className="input text-sm w-full" value={(step.hp as number) ?? 1} onChange={(e) => set("hp", Number(e.target.value))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Color">
                  <Select value={(step.color as string) ?? ""} onChange={(e) => set("color", e.target.value || undefined)}>
                    <option value="">None</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="red">Red</option>
                    <option value="white">White</option>
                    <option value="purple">Purple</option>
                  </Select>
                </Field>
                <Field label="Traits (comma-separated)">
                  <input
                    className="input text-sm w-full"
                    value={(step.traits as string[])?.join(", ") ?? ""}
                    onChange={(e) => set("traits", e.target.value ? e.target.value.split(",").map(s => s.trim()).filter(Boolean) : undefined)}
                    placeholder="e.g. Zeon, Mobile Suit"
                  />
                </Field>
              </div>
              <Field label="Keywords">
                <KeywordPicker
                  selected={((step.keywords as { keyword: string }[]) ?? []).map(k => k.keyword)}
                  onChange={(kws) => set("keywords", kws.length ? kws.map(kw => ({ keyword: kw })) : undefined)}
                />
              </Field>
            </>
          ) : (
            <Field label="Token ID (registry)">
              <input className="input text-sm w-full" value={(step.token_id as string) ?? ""} onChange={(e) => set("token_id", e.target.value || undefined)} placeholder="e.g. zaku_ii_token" />
            </Field>
          )}
        </>
      );
    }

    case "prompt_yes_no":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prompt text">
              <input className="input text-sm w-full" value={(step.prompt as string) ?? ""} onChange={(e) => set("prompt", e.target.value)} placeholder="Do you want to…?" />
            </Field>
            <Field label="Store as">
              <StoreAsInput value={(step.store_as as string) ?? ""} onChange={(v) => set("store_as", v)} placeholder="$choice" />
            </Field>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">If Yes</p>
            <StepList
              steps={(step.on_yes as unknown[]) ?? []}
              onChange={(on_yes) => onUpdate({ ...step, on_yes })}
              depth={depth + 1}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">If No</p>
            <StepList
              steps={(step.on_no as unknown[]) ?? []}
              onChange={(on_no) => onUpdate({ ...step, on_no })}
              depth={depth + 1}
            />
          </div>
        </>
      );

    case "prompt_choice":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prompt text">
              <input className="input text-sm w-full" value={(step.prompt as string) ?? ""} onChange={(e) => set("prompt", e.target.value)} placeholder="Choose one:" />
            </Field>
            <Field label="Store as">
              <StoreAsInput value={(step.store_as as string) ?? ""} onChange={(v) => set("store_as", v)} placeholder="$choice" />
            </Field>
          </div>
          <Field label='Options JSON — array of {label, value, sub_steps:[]}'>
            <textarea
              className="font-mono text-xs w-full border rounded-md p-2 bg-muted/20 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              rows={6}
              defaultValue={JSON.stringify(step.options ?? [], null, 2)}
              onBlur={(e) => { try { set("options", JSON.parse(e.target.value)); } catch { /* ignore */ } }}
            />
          </Field>
        </>
      );

    case "shuffle":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Side">
            <SideSelect value={(step.side as string) ?? "controller"} onChange={(v) => set("side", v)} />
          </Field>
          <Field label="Zone">
            <Select value={(step.zone as string) ?? "deck"} onChange={(e) => set("zone", e.target.value)}>
              <option value="deck">Deck</option>
              <option value="hand">Hand</option>
              <option value="trash">Trash</option>
            </Select>
          </Field>
        </div>
      );

    case "reveal":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target ($var)">
            <TargetInput value={(step.target as string) ?? ""} onChange={(v) => set("target", v)} />
          </Field>
          <Field label="Reveal to">
            <Select value={(step.to as string) ?? "all"} onChange={(e) => set("to", e.target.value)}>
              <option value="all">All players</option>
              <option value="controller">Controller only</option>
            </Select>
          </Field>
        </div>
      );

    case "peek_top":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Side">
              <SideSelect value={(step.side as string) ?? "friendly"} onChange={(v) => set("side", v)} />
            </Field>
            <Field label="Count (top N cards)">
              <input type="number" min={1} className="input text-sm w-full" value={(step.count as number) ?? 1} onChange={(e) => set("count", Number(e.target.value))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reveal to">
              <Select value={(step.reveal as string) ?? "controller"} onChange={(e) => set("reveal", e.target.value)}>
                <option value="controller">Controller only</option>
                <option value="all">All players</option>
              </Select>
            </Field>
            <Field label="Store as">
              <StoreAsInput value={(step.store_as as string) ?? ""} onChange={(v) => set("store_as", v)} placeholder="$peeked" />
            </Field>
          </div>
        </>
      );

    case "manual_resolve":
      return (
        <Field label="Prompt text">
          <textarea
            className="input text-sm resize-none w-full"
            rows={2}
            value={(step.prompt_text as string) ?? ""}
            onChange={(e) => set("prompt_text", e.target.value)}
            placeholder="Resolve this effect manually."
          />
        </Field>
      );

    default:
      return (
        <p className="text-xs text-muted-foreground italic">
          Unknown action type — add fields to StepEditor.tsx to support it.
        </p>
      );
  }
}

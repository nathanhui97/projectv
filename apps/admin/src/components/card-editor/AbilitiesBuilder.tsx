"use client";

import { useFormContext } from "react-hook-form";
import { useState, useEffect } from "react";
import type { CardFormValues } from "@/app/(admin)/cards/[id]/CardEditor";
import { Plus, Trash2, ChevronDown, ChevronRight, AlertCircle, Copy, CheckCheck, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, Select } from "./FormPrimitives";
import { StepList } from "./StepEditor";
import { StepSchema } from "@project-v/schemas";
import { z } from "zod";

// ─── Trigger types (kept in sync with TriggerSchema) ─────────────────────────

const TRIGGER_TYPES = [
  // Lifecycle
  "on_deploy", "on_destroyed", "on_burst",
  "on_pair", "on_unpair", "on_linked", "on_link_established",
  "on_attack", "on_attacked",
  "on_receives_damage", "on_receives_battle_damage", "on_receives_effect_damage",
  "on_damage_dealt", "on_battle_damage_dealt",
  "on_battle_destroy",
  "on_rested_by_effect", "on_set_active_by_effect",
  "on_card_drawn", "on_card_discarded",
  "on_resource_placed",
  "on_command_activated", "on_played_command",
  "on_shield_destroy", "on_shield_destroyed",
  "on_friendly_receives_damage", "on_friendly_receives_effect_damage",
  "on_friendly_rested_by_opponent_effect",
  // EX Resource
  "on_ex_resource_placed", "on_command_played_with_ex_resource",
  "on_resource_payment_for_unit_effect",
  // Phase
  "on_start_phase", "on_draw_phase", "on_resource_phase",
  "on_main_phase_start", "on_main_phase_end", "on_end_phase",
  "on_turn_start", "on_turn_end",
  "on_opponent_turn_start", "on_opponent_turn_end",
  // Activated
  "activated_main", "activated_action", "activated_main_or_action",
  // Continuous / static
  "during_pair", "during_link", "static",
] as const;

// ─── Qualifier configuration ──────────────────────────────────────────────────

const BOOL_QUALIFIERS: { key: string; label: string }[] = [
  { key: "once_per_turn",     label: "Once per turn" },
  { key: "your_turn_only",    label: "Your turn only" },
  { key: "opponent_turn_only",label: "Opponent turn only" },
  { key: "requires_pair",     label: "Requires: Paired" },
  { key: "requires_link",     label: "Requires: Linked" },
  { key: "target_is_unit",    label: "Attack target is unit (not player)" },
  { key: "attacking_player",  label: "Attacking player" },
  { key: "from_enemy",        label: "From enemy source" },
  { key: "battle_damage",     label: "Battle damage only" },
  { key: "not_self",          label: "Not self" },
];

const COLOR_OPTIONS = ["blue", "green", "red", "white", "purple"];

// ─── Step JSON templates ──────────────────────────────────────────────────────

const STEP_TEMPLATES: { label: string; value: object }[] = [
  // Targeting
  { label: "choose_target", value: { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { type: "unit" }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" } },
  { label: "all_matching", value: { action: "all_matching", filter: { all_of: [{ side: "enemy" }, { type: "unit" }] }, store_as: "$targets" } },
  { label: "all_matching (paired)", value: { action: "all_matching", filter: { paired_with_source: true }, store_as: "$paired" } },
  { label: "count_zone", value: { action: "count_zone", side: "friendly", zone: "battle_area", filter: { type: "unit" }, store_as: "$count" } },
  { label: "search_deck", value: { action: "search_deck", side: "friendly", filter: { type: "unit" }, count: 1, reveal: "private", store_as: "$found" } },
  { label: "peek_top", value: { action: "peek_top", side: "friendly", count: 1, reveal_to: "controller", store_as: "$peeked" } },
  { label: "look_at", value: { action: "look_at", target: "$target", reveal_to: "controller" } },
  // Card draw & deck
  { label: "draw", value: { action: "draw", side: "friendly", amount: 1 } },
  { label: "shuffle", value: { action: "shuffle", side: "friendly", zone: "deck" } },
  { label: "reveal", value: { action: "reveal", target: "$target", to: "all" } },
  // Card movement
  { label: "move_to_hand", value: { action: "move_to_hand", target: "$target" } },
  { label: "move_to_deck_top", value: { action: "move_to_deck_top", target: "$target" } },
  { label: "move_to_deck_bottom", value: { action: "move_to_deck_bottom", target: "$target" } },
  { label: "move_to_trash", value: { action: "move_to_trash", target: "$target" } },
  { label: "move_to_resource", value: { action: "move_to_resource", target: "$target", rest_state: "rested" } },
  { label: "move_to_shield", value: { action: "move_to_shield", target: "$target" } },
  { label: "discard", value: { action: "discard", target: "$target" } },
  { label: "discard_from_hand", value: { action: "discard_from_hand", side: "enemy", amount: 1, selector: "controller_chooses" } },
  { label: "exile", value: { action: "exile", target: "$target" } },
  { label: "mill", value: { action: "mill", target: "$target" } },
  { label: "deploy_card", value: { action: "deploy_card", target: "$target", pay_cost: false } },
  { label: "pair_pilot", value: { action: "pair_pilot", pilot: "$pilot", unit: "$unit" } },
  // Damage & combat
  { label: "deal_damage", value: { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" } },
  { label: "prevent_damage", value: { action: "prevent_damage", target: "$target", amount: 1, duration: "end_of_battle" } },
  { label: "destroy", value: { action: "destroy", target: "$target" } },
  { label: "heal", value: { action: "heal", target: "$self", amount: 1 } },
  { label: "grant_taunt", value: { action: "grant_taunt", target: "$target", duration: "end_of_turn" } },
  { label: "change_attack_target", value: { action: "change_attack_target", new_target: "$new_target" } },
  // Stats & abilities
  { label: "modify_stat", value: { action: "modify_stat", target: "$target", stat: "ap", amount: 1, duration: "end_of_turn" } },
  { label: "set_stat", value: { action: "set_stat", target: "$target", stat: "ap", value: 5, duration: "end_of_turn" } },
  { label: "modify_cost", value: { action: "modify_cost", target: "$target", amount: -1, duration: "end_of_turn" } },
  { label: "gain_keyword", value: { action: "gain_keyword", target: "$target", keywords: [{ keyword: "blocker" }], duration: "end_of_turn" } },
  { label: "lose_keyword", value: { action: "lose_keyword", target: "$target", keywords: ["blocker"], duration: "end_of_turn" } },
  { label: "gain_traits", value: { action: "gain_traits", target: "$target", traits: ["Newtype"], duration: "end_of_turn" } },
  { label: "copy_abilities", value: { action: "copy_abilities", target: "$target", source: "$source", duration: "end_of_turn" } },
  // State changes
  { label: "rest", value: { action: "rest", target: "$target" } },
  { label: "ready", value: { action: "ready", target: "$target" } },
  { label: "prevent_ready", value: { action: "prevent_ready", target: "$target", duration: "end_of_turn" } },
  // Counters
  { label: "add_counter", value: { action: "add_counter", target: "$target", counter_name: "charge", amount: 1 } },
  { label: "remove_counter", value: { action: "remove_counter", target: "$target", counter_name: "charge", amount: 1 } },
  // Resources
  { label: "add_ex_resource", value: { action: "add_ex_resource", side: "friendly", amount: 1 } },
  // Tokens
  { label: "create_token", value: { action: "create_token", token_id: "token_id_here", count: 1, side: "friendly", rest_state: "rested" } },
  // Choices
  { label: "prompt_yes_no", value: { action: "prompt_yes_no", prompt: "Do you want to…?", store_as: "$choice", on_yes: [], on_no: [] } },
  { label: "prompt_choice", value: { action: "prompt_choice", prompt: "Choose one:", store_as: "$choice", options: [{ label: "Option A", value: "a", sub_steps: [] }] } },
  { label: "prompt_number", value: { action: "prompt_number", prompt: "Choose a number:", min: 1, max: 5, store_as: "$n" } },
  // Misc
  { label: "manual_resolve", value: { action: "manual_resolve", prompt_text: "Resolve this effect manually." } },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Qualifiers = Record<string, unknown>;
type Trigger = { type: string; qualifiers?: Qualifiers; cost?: Record<string, unknown> };
type Ability = {
  id: string;
  display_text: string;
  trigger: Trigger;
  steps: unknown[];
  notes?: string;
};

function newAbility(): Ability {
  return {
    id: crypto.randomUUID().slice(0, 8),
    display_text: "",
    trigger: { type: "on_deploy" },
    steps: [],
  };
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function AbilitiesBuilder() {
  const { watch, setValue } = useFormContext<CardFormValues>();
  const abilities = (watch("abilities") ?? []) as Ability[];

  function setAbilities(next: Ability[]) {
    setValue("abilities", next, { shouldDirty: true });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Abilities ({abilities.length})
        </p>
        <button
          type="button"
          onClick={() => setAbilities([...abilities, newAbility()])}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add Ability
        </button>
      </div>

      {abilities.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-6 text-center border rounded-md">
          No abilities. Click "Add Ability" to start.
        </p>
      )}

      {abilities.map((ability, index) => (
        <AbilityCard
          key={ability.id ?? index}
          ability={ability}
          index={index}
          onUpdate={(patch) =>
            setAbilities(abilities.map((a, i) => (i === index ? { ...a, ...patch } : a)))
          }
          onRemove={() => setAbilities(abilities.filter((_, i) => i !== index))}
          onMoveUp={index > 0 ? () => {
            const next = [...abilities];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            setAbilities(next);
          } : undefined}
          onMoveDown={index < abilities.length - 1 ? () => {
            const next = [...abilities];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            setAbilities(next);
          } : undefined}
        />
      ))}
    </div>
  );
}

// ─── Single ability card ──────────────────────────────────────────────────────

function AbilityCard({
  ability, index, onUpdate, onRemove, onMoveUp, onMoveDown,
}: {
  ability: Ability;
  index: number;
  onUpdate: (patch: Partial<Ability>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isActivated = ability.trigger.type.startsWith("activated_");

  function setQualifier(key: string, value: unknown) {
    const q = { ...(ability.trigger.qualifiers ?? {}) };
    if (value === false || value === undefined || value === "") {
      delete q[key];
    } else {
      q[key] = value;
    }
    onUpdate({ trigger: { ...ability.trigger, qualifiers: Object.keys(q).length ? q : undefined } });
  }

  const q = ability.trigger.qualifiers ?? {};

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 select-none">
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="text-xs font-mono text-muted-foreground">a{index + 1}</span>
        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">
          {ability.trigger.type}
        </span>
        {Object.keys(q).length > 0 && (
          <span className="text-xs text-muted-foreground">
            [{Object.keys(q).filter(k => q[k]).join(", ")}]
          </span>
        )}
        <div className="flex-1 text-xs text-muted-foreground truncate pl-1">
          {ability.display_text}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onMoveUp && (
            <button type="button" onClick={onMoveUp} className="text-muted-foreground hover:text-foreground text-xs px-1">↑</button>
          )}
          {onMoveDown && (
            <button type="button" onClick={onMoveDown} className="text-muted-foreground hover:text-foreground text-xs px-1">↓</button>
          )}
          <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive ml-1">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Display text */}
          <Field label="Display Text" required>
            <textarea
              value={ability.display_text}
              onChange={(e) => onUpdate({ display_text: e.target.value })}
              rows={2}
              placeholder="【Trigger】Effect description shown on the card…"
              className="input resize-none"
            />
          </Field>

          {/* Trigger + qualifiers */}
          <div className="space-y-3 border rounded-md p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trigger</p>

            <Field label="Type">
              <Select
                value={ability.trigger.type}
                onChange={(e) => onUpdate({ trigger: { ...ability.trigger, type: e.target.value } })}
              >
                {TRIGGER_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </Field>

            {/* Boolean qualifiers */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {BOOL_QUALIFIERS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!q[key]}
                    onChange={(e) => setQualifier(key, e.target.checked || undefined)}
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* String / select qualifiers */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Field label="Pilot color">
                <Select
                  value={(q.pilot_color as string) ?? ""}
                  onChange={(e) => setQualifier("pilot_color", e.target.value || undefined)}
                >
                  <option value="">— any —</option>
                  {COLOR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Unit color">
                <Select
                  value={(q.unit_color as string) ?? ""}
                  onChange={(e) => setQualifier("unit_color", e.target.value || undefined)}
                >
                  <option value="">— any —</option>
                  {COLOR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Pilot max level">
                <input
                  type="number"
                  min={1}
                  value={(q.pilot_max_level as number) ?? ""}
                  onChange={(e) => setQualifier("pilot_max_level", e.target.value ? Number(e.target.value) : undefined)}
                  className="input"
                  placeholder="e.g. 3"
                />
              </Field>
              <Field label="Resource cost (qualifier)">
                <input
                  type="number"
                  min={0}
                  value={(q.resource_cost as number) ?? ""}
                  onChange={(e) => setQualifier("resource_cost", e.target.value ? Number(e.target.value) : undefined)}
                  className="input"
                  placeholder="e.g. 1"
                />
              </Field>
              <Field label="Pilot traits (comma-sep)">
                <input
                  value={Array.isArray(q.pilot_traits_include) ? (q.pilot_traits_include as string[]).join(", ") : ""}
                  onChange={(e) => setQualifier("pilot_traits_include",
                    e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined
                  )}
                  className="input text-xs"
                  placeholder="e.g. Newtype, Coordinator"
                />
              </Field>
              <Field label="Source traits (comma-sep)">
                <input
                  value={Array.isArray(q.source_traits) ? (q.source_traits as string[]).join(", ") : ""}
                  onChange={(e) => setQualifier("source_traits",
                    e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined
                  )}
                  className="input text-xs"
                  placeholder="e.g. Tekkadan, ZAFT"
                />
              </Field>
              <Field label="Attacker traits (comma-sep)">
                <input
                  value={Array.isArray(q.attacker_traits_include) ? (q.attacker_traits_include as string[]).join(", ") : ""}
                  onChange={(e) => setQualifier("attacker_traits_include",
                    e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined
                  )}
                  className="input text-xs"
                  placeholder="e.g. Zeon"
                />
              </Field>
              <Field label="Target traits (comma-sep)">
                <input
                  value={Array.isArray(q.target_traits_include) ? (q.target_traits_include as string[]).join(", ") : ""}
                  onChange={(e) => setQualifier("target_traits_include",
                    e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined
                  )}
                  className="input text-xs"
                  placeholder="e.g. Mobile Suit"
                />
              </Field>
              <Field label="Command traits (comma-sep)">
                <input
                  value={Array.isArray(q.command_traits) ? (q.command_traits as string[]).join(", ") : ""}
                  onChange={(e) => setQualifier("command_traits",
                    e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined
                  )}
                  className="input text-xs"
                  placeholder="e.g. Dawn of Fold"
                />
              </Field>
              <Field label="Attacker max AP">
                <input
                  type="number"
                  min={0}
                  value={(q.attacker_max_ap as number) ?? ""}
                  onChange={(e) => setQualifier("attacker_max_ap", e.target.value ? Number(e.target.value) : undefined)}
                  className="input"
                  placeholder="e.g. 3"
                />
              </Field>
            </div>

            {/* Activated cost */}
            {isActivated && (
              <div className="pt-2 space-y-2 border-t">
                <p className="text-xs font-medium text-muted-foreground">Activation Cost</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!ability.trigger.cost?.rest_self}
                      onChange={(e) =>
                        onUpdate({ trigger: { ...ability.trigger, cost: { ...ability.trigger.cost, rest_self: e.target.checked || undefined } } })
                      }
                    />
                    Rest self
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    Pay
                    <input
                      type="number"
                      min={0}
                      value={(ability.trigger.cost?.pay_resources as number) ?? ""}
                      onChange={(e) =>
                        onUpdate({ trigger: { ...ability.trigger, cost: { ...ability.trigger.cost, pay_resources: e.target.value ? Number(e.target.value) : undefined } } })
                      }
                      className="input w-16"
                      placeholder="0"
                    />
                    resources
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Steps */}
          <StepsSection
            steps={ability.steps ?? []}
            onChange={(steps) => onUpdate({ steps })}
          />

          {/* Notes */}
          <Field label="Authoring Notes">
            <input
              value={ability.notes ?? ""}
              onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
              placeholder="Scraper artifacts, edge cases, ruling notes…"
              className="input"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

// ─── Steps section — form mode + JSON fallback toggle ────────────────────────

function StepsSection({ steps, onChange }: { steps: unknown[]; onChange: (v: unknown[]) => void }) {
  const [jsonMode, setJsonMode] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Steps
        </p>
        <button
          type="button"
          onClick={() => setJsonMode((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Code className="h-3 w-3" />
          {jsonMode ? "Form view" : "JSON view"}
        </button>
      </div>

      {jsonMode ? (
        <JsonStepsEditor steps={steps} onChange={onChange} />
      ) : (
        <StepList steps={steps} onChange={onChange} />
      )}
    </div>
  );
}

function JsonStepsEditor({ steps, onChange }: { steps: unknown[]; onChange: (v: unknown[]) => void }) {
  const [text, setText] = useState(() => JSON.stringify(steps, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setText(JSON.stringify(steps, null, 2));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }
    if (!Array.isArray(parsed)) { setError("Steps must be a JSON array [ … ]"); return; }

    const result = z.array(StepSchema).safeParse(parsed);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue.path.length ? ` (step ${issue.path[0]}: ${issue.path.slice(1).join(".")})` : "";
      setError(`Schema error${path}: ${issue.message}`);
      // Still save to avoid blocking edits mid-typing
      onChange(parsed);
      return;
    }
    setError(null);
    onChange(parsed);
  }

  function insertTemplate(tpl: object) {
    try {
      const current = JSON.parse(text);
      const next = Array.isArray(current) ? [...current, tpl] : [tpl];
      const nextText = JSON.stringify(next, null, 2);
      setText(nextText);
      commit(nextText);
    } catch {
      const nextText = JSON.stringify([tpl], null, 2);
      setText(nextText);
      commit(nextText);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {STEP_TEMPLATES.map((tpl) => (
          <button
            key={tpl.label}
            type="button"
            onClick={() => insertTemplate(tpl.value)}
            className="text-xs px-1.5 py-0.5 bg-muted hover:bg-muted/80 rounded border text-muted-foreground hover:text-foreground"
          >
            + {tpl.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={copyToClipboard}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? <CheckCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        onBlur={(e) => commit(e.target.value)}
        rows={12}
        spellCheck={false}
        className={cn(
          "font-mono text-xs w-full border rounded-md p-3 bg-muted/20 resize-y focus:outline-none focus:ring-1",
          error ? "border-destructive focus:ring-destructive" : "focus:ring-ring"
        )}
        placeholder='[\n  { "action": "draw", "side": "controller", "amount": 1 }\n]'
      />

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

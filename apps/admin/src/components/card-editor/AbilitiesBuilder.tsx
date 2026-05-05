"use client";

import { useFormContext } from "react-hook-form";
import { useState, useEffect } from "react";
import type { CardFormValues } from "@/app/(admin)/cards/[id]/CardEditor";
import { Plus, Trash2, ChevronDown, ChevronRight, AlertCircle, Copy, CheckCheck, Code, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, Select } from "./FormPrimitives";
import { StepList } from "./StepEditor";
import { StepSchema } from "@project-v/schemas";
import { z } from "zod";

// ─── Trigger types ────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
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
  "on_ex_resource_placed", "on_command_played_with_ex_resource",
  "on_resource_payment_for_unit_effect",
  "on_start_phase", "on_draw_phase", "on_resource_phase",
  "on_main_phase_start", "on_main_phase_end", "on_end_phase",
  "on_turn_start", "on_turn_end",
  "on_opponent_turn_start", "on_opponent_turn_end",
  "activated_main", "activated_action", "activated_main_or_action",
  "during_pair", "during_link", "static",
] as const;

const BOOL_QUALIFIERS: { key: string; label: string }[] = [
  { key: "once_per_turn",       label: "Once per turn" },
  { key: "your_turn_only",      label: "Your turn only" },
  { key: "opponent_turn_only",  label: "Opponent turn only" },
  { key: "requires_pair",       label: "Requires: Paired" },
  { key: "requires_link",       label: "Requires: Linked" },
  { key: "target_is_unit",      label: "Attack target is unit" },
  { key: "attacking_player",    label: "Attacking player" },
  { key: "from_enemy",          label: "From enemy source" },
  { key: "battle_damage",       label: "Battle damage only" },
  { key: "not_self",            label: "Not self" },
];

const COLOR_OPTIONS = ["blue", "green", "red", "white", "purple"];

// ─── Step templates ───────────────────────────────────────────────────────────

const STEP_TEMPLATES: { label: string; value: object }[] = [
  { label: "choose_target", value: { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { type: "unit" }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" } },
  { label: "all_matching", value: { action: "all_matching", filter: { all_of: [{ side: "enemy" }, { type: "unit" }] }, store_as: "$targets" } },
  { label: "all_matching (paired)", value: { action: "all_matching", filter: { paired_with_source: true }, store_as: "$paired" } },
  { label: "count_zone", value: { action: "count_zone", side: "friendly", zone: "battle_area", filter: { type: "unit" }, store_as: "$count" } },
  { label: "search_deck", value: { action: "search_deck", side: "friendly", filter: { type: "unit" }, count: 1, reveal: "private", store_as: "$found" } },
  { label: "peek_top", value: { action: "peek_top", side: "friendly", count: 1, reveal_to: "controller", store_as: "$peeked" } },
  { label: "draw", value: { action: "draw", side: "friendly", amount: 1 } },
  { label: "deal_damage", value: { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" } },
  { label: "destroy", value: { action: "destroy", target: "$target" } },
  { label: "heal", value: { action: "heal", target: "$self", amount: 1 } },
  { label: "modify_stat", value: { action: "modify_stat", target: "$target", stat: "ap", amount: 1, duration: "end_of_turn" } },
  { label: "gain_keyword", value: { action: "gain_keyword", target: "$target", keywords: [{ keyword: "repair", amount: 1 }], duration: "end_of_turn" } },
  { label: "rest", value: { action: "rest", target: "$target" } },
  { label: "ready", value: { action: "ready", target: "$target" } },
  { label: "move_to_hand", value: { action: "move_to_hand", target: "$target" } },
  { label: "move_to_trash", value: { action: "move_to_trash", target: "$target" } },
  { label: "discard_from_hand", value: { action: "discard_from_hand", side: "enemy", amount: 1, selector: "controller_chooses" } },
  { label: "add_ex_resource", value: { action: "add_ex_resource", side: "friendly", amount: 1 } },
  { label: "create_token", value: { action: "create_token", token_id: "token_id_here", count: 1, side: "friendly", rest_state: "rested" } },
  { label: "prompt_yes_no", value: { action: "prompt_yes_no", prompt: "Do you want to…?", store_as: "$choice", on_yes: [], on_no: [] } },
  { label: "prompt_choice", value: { action: "prompt_choice", prompt: "Choose one:", store_as: "$choice", options: [{ label: "Option A", value: "a", sub_steps: [] }] } },
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

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AbilitiesBuilder() {
  const { watch, setValue } = useFormContext<CardFormValues>();
  const abilities = (watch("abilities") ?? []) as Ability[];

  function setAbilities(next: Ability[]) {
    setValue("abilities", next, { shouldDirty: true });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
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
        <p className="text-sm text-muted-foreground italic py-8 text-center border rounded-md border-dashed">
          No abilities yet.
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

// ─── AbilityCard ──────────────────────────────────────────────────────────────

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
  const [showQualifiers, setShowQualifiers] = useState(false);
  const isActivated = ability.trigger.type.startsWith("activated_");
  const q = ability.trigger.qualifiers ?? {};
  const activeQualifiers = Object.keys(q).filter(k => q[k]);

  function setQualifier(key: string, value: unknown) {
    const next = { ...q };
    if (value === false || value === undefined || value === "") delete next[key];
    else next[key] = value;
    onUpdate({ trigger: { ...ability.trigger, qualifiers: Object.keys(next).length ? next : undefined } });
  }

  return (
    <div className="border rounded-lg overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 select-none">
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <span className="text-xs text-muted-foreground font-mono shrink-0">a{index + 1}</span>
        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono shrink-0">
          {ability.trigger.type}
        </span>
        {activeQualifiers.length > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">[{activeQualifiers.join(", ")}]</span>
        )}
        <span className="flex-1 text-xs text-muted-foreground truncate pl-1 min-w-0">
          {ability.display_text}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {onMoveUp && <button type="button" onClick={onMoveUp} className="text-muted-foreground hover:text-foreground text-xs px-1">↑</button>}
          {onMoveDown && <button type="button" onClick={onMoveDown} className="text-muted-foreground hover:text-foreground text-xs px-1">↓</button>}
          <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive ml-1">
            <Trash2 className="h-3 w-3" />
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
              placeholder="【On Deploy】Effect description shown on the card…"
              className="input resize-none"
            />
          </Field>

          {/* Trigger row */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-14 shrink-0">Trigger</span>
              <Select
                value={ability.trigger.type}
                onChange={(e) => onUpdate({ trigger: { ...ability.trigger, type: e.target.value } })}
                className="flex-1"
              >
                {TRIGGER_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </Select>
              {/* Activation cost inline */}
              {isActivated && (
                <div className="flex items-center gap-3 shrink-0">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={!!ability.trigger.cost?.rest_self}
                      onChange={(e) =>
                        onUpdate({ trigger: { ...ability.trigger, cost: { ...ability.trigger.cost, rest_self: e.target.checked || undefined } } })
                      }
                    />
                    Rest self
                  </label>
                  <div className="flex items-center gap-1 text-xs whitespace-nowrap">
                    Pay
                    <input
                      type="number"
                      min={0}
                      value={(ability.trigger.cost?.pay_resources as number) ?? ""}
                      onChange={(e) =>
                        onUpdate({ trigger: { ...ability.trigger, cost: { ...ability.trigger.cost, pay_resources: e.target.value ? Number(e.target.value) : undefined } } })
                      }
                      className="input w-14 text-xs mx-1"
                      placeholder="0"
                    />
                    res
                  </div>
                </div>
              )}
            </div>

            {/* Qualifiers toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowQualifiers(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="h-3 w-3" />
                Qualifiers
                {activeQualifiers.length > 0 && (
                  <span className="text-primary font-medium">({activeQualifiers.length} active)</span>
                )}
                {showQualifiers ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>

              {/* Active qualifier pills when collapsed */}
              {!showQualifiers && activeQualifiers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {activeQualifiers.map(k => (
                    <span key={k} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {k.replace(/_/g, " ")} {typeof q[k] !== "boolean" ? `= ${String(q[k])}` : ""}
                    </span>
                  ))}
                </div>
              )}

              {showQualifiers && (
                <div className="mt-2 rounded-md bg-muted/30 p-3 space-y-3">
                  {/* Boolean qualifiers */}
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {BOOL_QUALIFIERS.map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!q[key]}
                          onChange={(e) => setQualifier(key, e.target.checked || undefined)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  {/* String/number qualifiers */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "pilot_color",            label: "Pilot color",          type: "color" },
                      { key: "unit_color",             label: "Unit color",           type: "color" },
                      { key: "pilot_max_level",        label: "Pilot max level",      type: "number" },
                      { key: "resource_cost",          label: "Resource cost",        type: "number" },
                      { key: "attacker_max_ap",        label: "Attacker max AP",      type: "number" },
                      { key: "pilot_traits_include",   label: "Pilot traits",         type: "traits" },
                      { key: "source_traits",          label: "Source traits",        type: "traits" },
                      { key: "attacker_traits_include",label: "Attacker traits",      type: "traits" },
                      { key: "target_traits_include",  label: "Target traits",        type: "traits" },
                      { key: "command_traits",         label: "Command traits",       type: "traits" },
                    ].map(({ key, label, type }) => (
                      <div key={key}>
                        <p className="text-xs text-muted-foreground mb-1">{label}</p>
                        {type === "color" ? (
                          <Select
                            value={(q[key] as string) ?? ""}
                            onChange={(e) => setQualifier(key, e.target.value || undefined)}
                            className="text-xs"
                          >
                            <option value="">— any —</option>
                            {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          </Select>
                        ) : type === "number" ? (
                          <input
                            type="number"
                            min={0}
                            value={(q[key] as number) ?? ""}
                            onChange={(e) => setQualifier(key, e.target.value ? Number(e.target.value) : undefined)}
                            className="input text-xs"
                            placeholder="—"
                          />
                        ) : (
                          <input
                            value={Array.isArray(q[key]) ? (q[key] as string[]).join(", ") : ""}
                            onChange={(e) => setQualifier(key,
                              e.target.value ? e.target.value.split(",").map(s => s.trim()).filter(Boolean) : undefined
                            )}
                            className="input text-xs"
                            placeholder="comma-sep"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Steps */}
          <StepsSection
            steps={ability.steps ?? []}
            onChange={(steps) => onUpdate({ steps })}
          />

          {/* Notes — compact */}
          <input
            value={ability.notes ?? ""}
            onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
            placeholder="Authoring notes (optional)"
            className="input text-xs"
          />

        </div>
      )}
    </div>
  );
}

// ─── Steps section ────────────────────────────────────────────────────────────

function StepsSection({ steps, onChange }: { steps: unknown[]; onChange: (v: unknown[]) => void }) {
  const [jsonMode, setJsonMode] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Steps</p>
        <button
          type="button"
          onClick={() => setJsonMode(v => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Code className="h-3 w-3" />
          {jsonMode ? "Form" : "JSON"}
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
    try { parsed = JSON.parse(raw); } catch (e) { setError(e instanceof Error ? e.message : "Invalid JSON"); return; }
    if (!Array.isArray(parsed)) { setError("Steps must be a JSON array [ … ]"); return; }
    const result = z.array(StepSchema).safeParse(parsed);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue.path.length ? ` (step ${issue.path[0]}: ${issue.path.slice(1).join(".")})` : "";
      setError(`Schema error${path}: ${issue.message}`);
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
          onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
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
        placeholder={'[\n  { "action": "draw", "side": "controller", "amount": 1 }\n]'}
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

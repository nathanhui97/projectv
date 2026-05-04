"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { useState } from "react";
import type { CardFormValues } from "@/app/(admin)/cards/[id]/CardEditor";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, Select } from "./FormPrimitives";

const TRIGGER_TYPES = [
  // Lifecycle
  "on_deploy", "on_destroyed", "on_attack", "on_attacked",
  "on_damage_dealt", "on_damage_taken", "on_burst",
  "on_pair", "on_unpair", "on_link_established",
  "on_played_command", "on_resource_placed",
  "on_shield_destroyed", "on_card_drawn", "on_card_discarded",
  // Phase
  "on_start_phase", "on_draw_phase", "on_resource_phase",
  "on_main_phase_start", "on_main_phase_end", "on_end_phase",
  "on_turn_start", "on_turn_end",
  "on_opponent_turn_start", "on_opponent_turn_end",
  // Activated
  "activated_main", "activated_action",
  // Continuous
  "during_pair", "during_link", "static",
] as const;

const STEP_ACTION_TYPES = [
  "draw", "deal_damage", "destroy", "heal", "rest", "ready",
  "move_to_hand", "move_to_trash", "move_to_deck",
  "modify_stat", "gain_keyword", "choose_target", "all_matching",
  "search_deck", "shuffle", "create_token", "prompt_choice",
  "manual_resolve", "noop",
] as const;

type Ability = {
  id: string;
  display_text: string;
  trigger: { type: string; qualifiers?: Record<string, unknown>; cost?: Record<string, unknown> };
  steps: Step[];
  notes?: string;
};

type Step = {
  action: string;
  store_as?: string;
  [key: string]: unknown;
};

function newAbility(): Ability {
  return {
    id: crypto.randomUUID(),
    display_text: "",
    trigger: { type: "on_deploy" },
    steps: [],
  };
}

function newStep(): Step {
  return { action: "draw" };
}

export default function AbilitiesBuilder() {
  const { watch, setValue } = useFormContext<CardFormValues>();
  const abilities = (watch("abilities") ?? []) as Ability[];

  function setAbilities(next: Ability[]) {
    setValue("abilities", next, { shouldDirty: true });
  }

  function addAbility() {
    setAbilities([...abilities, newAbility()]);
  }

  function removeAbility(index: number) {
    setAbilities(abilities.filter((_, i) => i !== index));
  }

  function updateAbility(index: number, patch: Partial<Ability>) {
    setAbilities(abilities.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Abilities ({abilities.length})
        </h2>
        <button
          type="button"
          onClick={addAbility}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add Ability
        </button>
      </div>

      {abilities.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-4 text-center border rounded-md">
          No abilities yet. Click "Add Ability" to start.
        </p>
      )}

      {abilities.map((ability, index) => (
        <AbilityCard
          key={ability.id}
          ability={ability}
          index={index}
          onUpdate={(patch) => updateAbility(index, patch)}
          onRemove={() => removeAbility(index)}
        />
      ))}
    </div>
  );
}

function AbilityCard({
  ability,
  index,
  onUpdate,
  onRemove,
}: {
  ability: Ability;
  index: number;
  onUpdate: (patch: Partial<Ability>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  function addStep() {
    onUpdate({ steps: [...ability.steps, newStep()] });
  }

  function removeStep(si: number) {
    onUpdate({ steps: ability.steps.filter((_, i) => i !== si) });
  }

  function updateStep(si: number, patch: Partial<Step>) {
    onUpdate({
      steps: ability.steps.map((s, i) => (i === si ? { ...s, ...patch } : s)),
    });
  }

  const isActivated = ability.trigger.type.startsWith("activated_");

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="text-xs font-medium text-muted-foreground">Ability {index + 1}</span>
        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded capitalize">
          {ability.trigger.type.replace(/_/g, " ")}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Display text */}
          <Field label="Display Text" required>
            <textarea
              value={ability.display_text}
              onChange={(e) => onUpdate({ display_text: e.target.value })}
              rows={2}
              placeholder="Plain-English description of this ability…"
              className="input resize-none"
            />
          </Field>

          {/* Trigger */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Trigger">
              <Select
                value={ability.trigger.type}
                onChange={(e) =>
                  onUpdate({ trigger: { ...ability.trigger, type: e.target.value } })
                }
              >
                {TRIGGER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Once per turn qualifier */}
            <Field label="Options">
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!ability.trigger.qualifiers?.once_per_turn}
                    onChange={(e) =>
                      onUpdate({
                        trigger: {
                          ...ability.trigger,
                          qualifiers: { ...ability.trigger.qualifiers, once_per_turn: e.target.checked || undefined },
                        },
                      })
                    }
                  />
                  Once per turn
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!ability.trigger.qualifiers?.your_turn_only}
                    onChange={(e) =>
                      onUpdate({
                        trigger: {
                          ...ability.trigger,
                          qualifiers: { ...ability.trigger.qualifiers, your_turn_only: e.target.checked || undefined },
                        },
                      })
                    }
                  />
                  Your turn only
                </label>
              </div>
            </Field>
          </div>

          {/* Activated cost */}
          {isActivated && (
            <div className="p-3 bg-muted/50 rounded-md space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Activation Cost</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!ability.trigger.cost?.rest_self}
                    onChange={(e) =>
                      onUpdate({
                        trigger: {
                          ...ability.trigger,
                          cost: { ...ability.trigger.cost, rest_self: e.target.checked || undefined },
                        },
                      })
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
                      onUpdate({
                        trigger: {
                          ...ability.trigger,
                          cost: {
                            ...ability.trigger.cost,
                            pay_resources: e.target.value ? Number(e.target.value) : undefined,
                          },
                        },
                      })
                    }
                    className="input w-16"
                    placeholder="0"
                  />
                  resources
                </label>
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Steps ({ability.steps.length})
            </p>
            {ability.steps.map((step, si) => (
              <StepRow
                key={si}
                step={step}
                index={si}
                onUpdate={(patch) => updateStep(si, patch)}
                onRemove={() => removeStep(si)}
              />
            ))}
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Add step
            </button>
          </div>

          {/* Notes */}
          <Field label="Authoring Notes">
            <input
              value={ability.notes ?? ""}
              onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
              placeholder="Ruling notes, edge cases…"
              className="input"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function StepRow({
  step,
  index,
  onUpdate,
  onRemove,
}: {
  step: Step;
  index: number;
  onUpdate: (patch: Partial<Step>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2 p-2 border rounded-md bg-background">
      <span className="text-xs text-muted-foreground mt-2 w-4 shrink-0">{index + 1}.</span>

      <div className="flex-1 grid grid-cols-2 gap-2">
        <Select
          value={step.action}
          onChange={(e) => onUpdate({ action: e.target.value })}
        >
          {STEP_ACTION_TYPES.map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, " ")}
            </option>
          ))}
        </Select>

        {/* store_as variable */}
        <input
          value={(step.store_as as string) ?? ""}
          onChange={(e) => onUpdate({ store_as: e.target.value || undefined })}
          placeholder="Store as $var (optional)"
          className="input text-xs"
        />

        {/* Action-specific params — common ones */}
        {step.action === "draw" && (
          <input
            type="number"
            min={1}
            value={(step.amount as number) ?? ""}
            onChange={(e) => onUpdate({ amount: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Amount"
            className="input"
          />
        )}
        {step.action === "deal_damage" && (
          <input
            type="number"
            min={0}
            value={(step.amount as number) ?? ""}
            onChange={(e) => onUpdate({ amount: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Damage amount"
            className="input"
          />
        )}
        {step.action === "modify_stat" && (
          <>
            <Select
              value={(step.stat as string) ?? "ap"}
              onChange={(e) => onUpdate({ stat: e.target.value })}
            >
              {["ap", "hp", "cost"].map((s) => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </Select>
            <input
              type="number"
              value={(step.amount as number) ?? ""}
              onChange={(e) => onUpdate({ amount: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="±Amount"
              className="input"
            />
          </>
        )}
        {step.action === "gain_keyword" && (
          <Select
            value={(step.keyword as string) ?? "repair"}
            onChange={(e) => onUpdate({ keyword: e.target.value })}
          >
            {["repair", "breach", "support", "blocker", "first_strike", "high_maneuver", "suppression"].map((k) => (
              <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
            ))}
          </Select>
        )}
        {step.action === "manual_resolve" && (
          <input
            value={(step.prompt_text as string) ?? ""}
            onChange={(e) => onUpdate({ prompt_text: e.target.value })}
            placeholder="Prompt shown to players…"
            className="input col-span-2"
          />
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive mt-1.5"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

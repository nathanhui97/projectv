"use client";

import { useFormContext } from "react-hook-form";
import type { CardFormValues } from "@/app/(admin)/cards/[id]/CardEditor";
import { Field } from "./FormPrimitives";

export default function StatsSection({ cardType }: { cardType: string }) {
  const { register } = useFormContext<CardFormValues>();

  const isUnit = cardType === "unit";
  const isPilot = cardType === "pilot";
  const isCommand = cardType === "command";
  const showCost = isUnit || isPilot || isCommand;
  const showLevel = isUnit;
  const showAP = isUnit;
  const showHP = isUnit || isPilot;
  const showPilotMods = isPilot;

  return (
    <section>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Stats</p>
      <div className="grid grid-cols-4 gap-4">
        {showCost && (
          <Field label="Cost">
            <input type="number" min={0} {...register("cost")} className="input" />
          </Field>
        )}
        {showLevel && (
          <Field label="Level">
            <input type="number" min={0} {...register("level")} className="input" />
          </Field>
        )}
        {showAP && (
          <Field label="AP">
            <input type="number" {...register("ap")} className="input" />
          </Field>
        )}
        {showHP && (
          <Field label="HP">
            <input type="number" {...register("hp")} className="input" />
          </Field>
        )}
        {showPilotMods && (
          <>
            <Field label="AP Mod">
              <input type="number" {...register("pilot_modifiers.ap_mod")} className="input" placeholder="+0" />
            </Field>
            <Field label="HP Mod">
              <input type="number" {...register("pilot_modifiers.hp_mod")} className="input" placeholder="+0" />
            </Field>
          </>
        )}
      </div>
      {!showCost && !showAP && !showHP && (
        <p className="text-sm text-muted-foreground italic">No stats for this card type.</p>
      )}
      {isUnit && (
        <div className="mt-4">
          <Field label="Link condition" hint="Which pilot(s) can pair with this unit — e.g. [Amuro Ray]">
            <input
              {...register("link_text")}
              placeholder="[Amuro Ray]"
              className="input"
            />
          </Field>
        </div>
      )}
    </section>
  );
}

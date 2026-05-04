"use client";

import { useFormContext } from "react-hook-form";
import type { CardFormValues } from "@/app/(admin)/cards/[id]/CardEditor";
import { Field, FieldError, Select } from "./FormPrimitives";

const CARD_TYPES = ["unit", "pilot", "command", "base", "resource", "token"] as const;
const COLORS = ["blue", "green", "red", "white"] as const;
const RARITIES = ["common", "uncommon", "rare", "super_rare", "legendary_rare", "promo"] as const;

export default function BasicInfoSection() {
  const { register, formState: { errors } } = useFormContext<CardFormValues>();

  return (
    <section>
      <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
        Basic Info
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Card ID" required error={errors.id?.message}>
          <input
            {...register("id")}
            placeholder="GD01-042"
            className="input"
          />
        </Field>

        <Field label="Name" required error={errors.name?.message}>
          <input
            {...register("name")}
            placeholder="Strike Freedom Gundam"
            className="input"
          />
        </Field>

        <Field label="Set Code" required error={errors.set_code?.message}>
          <input
            {...register("set_code")}
            placeholder="GD01"
            className="input"
          />
        </Field>

        <Field label="Card Number" required error={errors.card_number?.message}>
          <input
            {...register("card_number")}
            placeholder="042"
            className="input"
          />
        </Field>

        <Field label="Type" required>
          <Select {...register("type")}>
            {CARD_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </Select>
        </Field>

        <Field label="Color">
          <Select {...register("color")}>
            <option value="">— None —</option>
            {COLORS.map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </Select>
        </Field>

        <Field label="Rarity" required>
          <Select {...register("rarity")}>
            {RARITIES.map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </Field>

        <Field label="Display Name (Plan B)">
          <input
            {...register("display_name")}
            placeholder="Optional stripped name"
            className="input"
          />
        </Field>

        <Field label="Flavor Text" className="col-span-2">
          <input
            {...register("flavor_text")}
            placeholder="Optional flavor text"
            className="input"
          />
        </Field>
      </div>
    </section>
  );
}

import { z } from 'zod';
import {
  SideSchema, ZoneSchema, CardTypeSchema, ColorSchema,
  ComparisonOpSchema, KeywordSchema,
} from './primitives';

const NumericComparisonSchema = z.object({
  op: ComparisonOpSchema,
  value: z.number().int(),
});

export type Filter =
  | { side: z.infer<typeof SideSchema> }
  | { zone: z.infer<typeof ZoneSchema> | z.infer<typeof ZoneSchema>[] }
  | { type: z.infer<typeof CardTypeSchema> | z.infer<typeof CardTypeSchema>[] }
  | { color: z.infer<typeof ColorSchema> | z.infer<typeof ColorSchema>[] }
  | { traits_include: string[] }
  | { traits_any: string[] }
  | { traits_exclude: string[] }
  | { cost: { op: z.infer<typeof ComparisonOpSchema>; value: number } }
  | { level: { op: z.infer<typeof ComparisonOpSchema>; value: number } }
  | { ap: { op: z.infer<typeof ComparisonOpSchema>; value: number } }
  | { hp: { op: z.infer<typeof ComparisonOpSchema>; value: number } }
  | { has_keyword: z.infer<typeof KeywordSchema>[] }
  | { has_any_keyword: z.infer<typeof KeywordSchema>[] }
  | { is_paired: boolean }
  | { is_linked: boolean }
  | { is_resting: boolean }
  | { is_active: boolean }
  | { is_damaged: boolean }
  | { name_is: string }
  | { name_includes: string }
  | { set_code: string | string[] }
  | { card_id: string | string[] }
  | { exclude_self: boolean }
  | { exclude: string[] }
  | { all_of: Filter[] }
  | { any_of: Filter[] }
  | { not: Filter };

export const FilterSchema: z.ZodType<Filter> = z.lazy(() =>
  z.union([
    z.object({ side: SideSchema }),
    z.object({ zone: z.union([ZoneSchema, z.array(ZoneSchema)]) }),
    z.object({ type: z.union([CardTypeSchema, z.array(CardTypeSchema)]) }),
    z.object({ color: z.union([ColorSchema, z.array(ColorSchema)]) }),
    z.object({ traits_include: z.array(z.string()) }),
    z.object({ traits_any: z.array(z.string()) }),
    z.object({ traits_exclude: z.array(z.string()) }),
    z.object({ cost: NumericComparisonSchema }),
    z.object({ level: NumericComparisonSchema }),
    z.object({ ap: NumericComparisonSchema }),
    z.object({ hp: NumericComparisonSchema }),
    z.object({ has_keyword: z.array(KeywordSchema) }),
    z.object({ has_any_keyword: z.array(KeywordSchema) }),
    z.object({ is_paired: z.boolean() }),
    z.object({ is_linked: z.boolean() }),
    z.object({ is_resting: z.boolean() }),
    z.object({ is_active: z.boolean() }),
    z.object({ is_damaged: z.boolean() }),
    z.object({ name_is: z.string() }),
    z.object({ name_includes: z.string() }),
    z.object({ set_code: z.union([z.string(), z.array(z.string())]) }),
    z.object({ card_id: z.union([z.string(), z.array(z.string())]) }),
    z.object({ exclude_self: z.boolean() }),
    z.object({ exclude: z.array(z.string()) }),
    z.object({ all_of: z.array(FilterSchema) }),
    z.object({ any_of: z.array(FilterSchema) }),
    z.object({ not: FilterSchema }),
  ])
);

import type { Filter } from './filter';

// Flat multi-key format used by the admin UI's FilterBuilder.
// Always converted to formal FilterSchema before storage via normalizeFilter().
export type ShorthandFilter = {
  side?: "friendly" | "enemy" | "any";
  type?: "unit" | "pilot" | "command" | "base" | "token";
  color?: "blue" | "green" | "red" | "white" | "purple";
  traits?: string[];
  max_level?: number;
  min_level?: number;
  min_hp?: number;
  max_hp?: number;
  max_ap?: number;
  min_ap?: number;
  min_cost?: number;
  max_cost?: number;
  zone?: string;
  name_is?: string;
  name_includes?: string;
  has_keyword?: string[];
  is_token?: boolean;
  rested?: boolean;
  is_active?: boolean;
  is_damaged?: boolean;
  is_paired?: boolean;
  is_linked?: boolean;
  not_self?: boolean;
  paired_with_source?: boolean;
};

// Keys that only appear in FilterSchema (never in ShorthandFilter).
// If an object has any of these, it's already formal FilterSchema — pass through.
// Keys that only appear in formal FilterSchema (never in ShorthandFilter).
// zone, has_keyword, is_token, name_is, name_includes are now shorthand keys too,
// so they're removed from here — shorthandToFilter handles them explicitly.
const FORMAL_ONLY_KEYS = new Set([
  'all_of', 'any_of', 'not',
  'traits_include', 'traits_any', 'traits_exclude',
  'cost', 'level', 'ap', 'hp',
  'has_any_keyword', 'is_resting',
  'set_code', 'card_id',
  'exclude', 'exclude_self',
  'paired_with_source',           // runtime-context filter, always formal
]);

function shorthandToFilter(f: ShorthandFilter): Filter {
  const clauses: Filter[] = [];

  if (f.side)               clauses.push({ side: f.side });
  if (f.type)               clauses.push({ type: f.type });
  if (f.color)              clauses.push({ color: f.color });
  if (f.traits?.length)     clauses.push({ traits_include: f.traits });
  if (f.min_level != null)  clauses.push({ level: { op: '>=', value: f.min_level } });
  if (f.max_level != null)  clauses.push({ level: { op: '<=', value: f.max_level } });
  if (f.min_hp != null)     clauses.push({ hp: { op: '>=', value: f.min_hp } });
  if (f.max_hp != null)     clauses.push({ hp: { op: '<=', value: f.max_hp } });
  if (f.min_ap != null)     clauses.push({ ap: { op: '>=', value: f.min_ap } });
  if (f.max_ap != null)     clauses.push({ ap: { op: '<=', value: f.max_ap } });
  if (f.min_cost != null)   clauses.push({ cost: { op: '>=', value: f.min_cost } });
  if (f.max_cost != null)   clauses.push({ cost: { op: '<=', value: f.max_cost } });
  if (f.zone)               clauses.push({ zone: f.zone as never });
  if (f.name_is)            clauses.push({ name_is: f.name_is });
  if (f.name_includes)      clauses.push({ name_includes: f.name_includes });
  if (f.has_keyword?.length) clauses.push({ has_keyword: f.has_keyword as never });
  if (f.is_token)           clauses.push({ is_token: true });
  if (f.rested)             clauses.push({ is_resting: true });
  if (f.is_active)          clauses.push({ is_active: true });
  if (f.is_damaged)         clauses.push({ is_damaged: true });
  if (f.is_paired)          clauses.push({ is_paired: true });
  if (f.is_linked)          clauses.push({ is_linked: true });
  if (f.not_self)           clauses.push({ exclude_self: true });
  if (f.paired_with_source) clauses.push({ paired_with_source: true });

  if (clauses.length === 0) throw new Error('shorthandToFilter: filter has no conditions');
  if (clauses.length === 1) return clauses[0];
  return { all_of: clauses };
}

// Accepts either a ShorthandFilter or an already-formal FilterSchema object.
// Returns a valid FilterSchema Filter.
export function normalizeFilter(f: unknown): Filter {
  if (!f || typeof f !== 'object' || Array.isArray(f)) {
    throw new Error('normalizeFilter: expected a filter object');
  }
  const obj = f as Record<string, unknown>;
  // If any key is formal-schema-only, it's already valid FilterSchema
  if (Object.keys(obj).some(k => FORMAL_ONLY_KEYS.has(k))) {
    return obj as Filter;
  }
  return shorthandToFilter(obj as ShorthandFilter);
}

// Normalizes a TargetRef: if it's { filter: ShorthandFilter }, converts the filter.
function normalizeTargetRef(target: unknown): unknown {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return target;
  const t = target as Record<string, unknown>;
  if ('filter' in t && t.filter && typeof t.filter === 'object') {
    return { filter: normalizeFilter(t.filter) };
  }
  return target;
}

// Recursively converts all filter fields in a step tree.
export function normalizeStepFilters(step: unknown): unknown {
  if (!step || typeof step !== 'object' || Array.isArray(step)) return step;
  const s = step as Record<string, unknown>;
  const out: Record<string, unknown> = { ...s };

  if (s.filter && typeof s.filter === 'object') {
    out.filter = normalizeFilter(s.filter);
  }

  // Normalize filter-object TargetRefs on all target fields
  for (const field of ['target', 'new_target', 'pilot', 'unit', 'source']) {
    if (s[field] && typeof s[field] === 'object') {
      out[field] = normalizeTargetRef(s[field]);
    }
  }

  if (Array.isArray(s.on_yes))  out.on_yes = s.on_yes.map(normalizeStepFilters);
  if (Array.isArray(s.on_no))   out.on_no  = s.on_no.map(normalizeStepFilters);
  if (Array.isArray(s.options)) {
    out.options = (s.options as Record<string, unknown>[]).map(opt => ({
      ...opt,
      sub_steps: Array.isArray(opt.sub_steps)
        ? opt.sub_steps.map(normalizeStepFilters)
        : opt.sub_steps,
    }));
  }

  return out;
}

// Converts all filter fields in all steps of an ability.
export function normalizeAbilityFilters(ability: unknown): unknown {
  if (!ability || typeof ability !== 'object') return ability;
  const a = ability as Record<string, unknown>;
  return {
    ...a,
    steps: Array.isArray(a.steps) ? a.steps.map(normalizeStepFilters) : a.steps,
  };
}

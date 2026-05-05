import type { CardInstance } from '@project-v/schemas';
import type { Card } from '@project-v/schemas';

export interface EffectiveStats {
  ap: number;
  hp: number;         // maximum HP after modifiers
  currentHp: number;  // hp - damage
  level: number;
  cost: number;
  keywords: Array<{ keyword: string; amount?: number }>;
  traits: string[];
  color: string | undefined;
  type: string;
}

export function resolveEffectiveStats(
  instance: CardInstance,
  baseCard: Card,
): EffectiveStats {
  let apDelta = 0;
  let hpDelta = 0;
  const gainedKeywords: Array<{ keyword: string; amount?: number }> = [];
  const gainedTraits: string[] = [];

  for (const mod of instance.temporary_modifiers) {
    if (mod.stat === 'ap' && mod.amount !== undefined) apDelta += mod.amount;
    if (mod.stat === 'hp' && mod.amount !== undefined) hpDelta += mod.amount;
    if (mod.keyword) gainedKeywords.push({ keyword: mod.keyword, amount: mod.amount ?? undefined });
    if (mod.trait) gainedTraits.push(mod.trait);
  }

  const effectiveHp = (baseCard.hp ?? 0) + hpDelta;

  return {
    ap: (baseCard.ap ?? 0) + apDelta,
    hp: effectiveHp,
    currentHp: effectiveHp - instance.damage,
    level: baseCard.level ?? 0,
    cost: baseCard.cost ?? 0,
    keywords: [
      ...baseCard.keywords.map((k) => ({ keyword: k.keyword, amount: k.amount })),
      ...gainedKeywords,
    ],
    traits: [...baseCard.traits, ...gainedTraits],
    color: baseCard.color,
    type: baseCard.type,
  };
}

export function hasKeyword(stats: EffectiveStats, keyword: string): boolean {
  return stats.keywords.some((k) => k.keyword === keyword);
}

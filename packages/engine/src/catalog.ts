import type { Card } from '@project-v/schemas';

export type CardCatalog = ReadonlyMap<string, Card>;

export function lookupCard(catalog: CardCatalog, cardId: string): Card {
  const card = catalog.get(cardId);
  if (!card) throw new Error(`Card "${cardId}" not found in catalog`);
  return card;
}

export function buildCatalog(cards: Card[]): CardCatalog {
  return new Map(cards.map((c) => [c.id, c]));
}

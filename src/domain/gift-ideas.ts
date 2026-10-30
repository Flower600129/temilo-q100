import type { QlooEntity } from '../qloo/contracts';
import type { Snapshot, TasteRun } from './schemas';
import { normalizedGiftTitle, previouslyGiven } from './gift-sources';
const directionTitle = (entity: QlooEntity) => `${entity.entityType === 'urn:entity:book' ? 'An edition of' : entity.entityType === 'urn:entity:movie' ? 'A film experience around' : entity.entityType === 'urn:entity:artist' ? 'A music experience around' : entity.entityType === 'urn:entity:brand' ? 'Explore a gift from' : 'Explore'} ${entity.name}`.slice(0, 200);
// Real search can return the same name or even the same ID under different
// categories. Selection and list keys use the composite type+ID so the two
// never collapse into one wrong pick.
export const entityKey = (entity: Pick<QlooEntity, 'entityId' | 'entityType'>) => `${entity.entityType ?? 'entity'}:${entity.entityId}`;
export function uniqueEntities(entities: QlooEntity[]): QlooEntity[] {
  return [...new Map(entities.map((entity) => [entityKey(entity), entity])).values()];
}
// Why a returned entity is not offered/adoptable for this friend right now,
// checked against the CURRENT records. Re-checked before adoption because
// another tab may change avoids or history while a response is in flight.
// Accepts stored evidence entries too (name optional there); without a name
// the title checks cannot run and the direction stays allowed.
export function directionBlockReason(snapshot: Snapshot, personId: string, entity: { entityId: string; entityType?: string; name?: string }): string | null {
  const person = snapshot.people.find((p) => p.id === personId);
  if (!person) return 'This friend is no longer available.';
  if (entity.name === undefined) return null;
  const title = directionTitle({ ...entity, name: entity.name });
  const name = entity.name.toLocaleLowerCase();
  const avoid = (person.dislikes ?? []).find((word) => name.includes(word.toLocaleLowerCase()));
  if (avoid) return `The recorded avoids now match this direction (${avoid}).`;
  if (previouslyGiven(snapshot, personId, entity.name, [entity.entityId]).length) return 'A matching cultural direction was already given to this friend.';
  if (snapshot.gifts.some((gift) => gift.personId === personId && gift.status === 'given' && normalizedGiftTitle(gift.giftTitle) === normalizedGiftTitle(title))) return 'A gift matching this direction was already recorded as given.';
  return null;
}
// Explicit templates, not a claimed LLM call. Only actual returned entities may be used.
export function giftDirections(snapshot: Snapshot, personId: string, entities: QlooEntity[]): TasteRun['suggestions'] {
  const person = snapshot.people.find((p) => p.id === personId);
  if (!person) throw new Error('Choose a saved friend.');
  return uniqueEntities(entities).filter((entity) => directionBlockReason(snapshot, personId, entity) === null).slice(0, 3).map((entity) => ({
    id: `${entity.entityType ?? 'entity'}:${entity.entityId}`.slice(0, 200), title: directionTitle(entity),
    rationale: `Qloo returned ${entity.name}${entity.entityType ? ` (${entity.entityType.replace('urn:entity:', '')})` : ''} for your selected cultural signals. This direction is a template based on that returned entity.`,
    limitations: ['Cultural association is not a verified personal wish.', 'Confirm product details, price, budget and local availability yourself.', ...(person.dislikes?.length ? [`Check actual contents against recorded avoids: ${person.dislikes.join(', ')}.`] : [])],
    evidenceEntityIds: [entity.entityId],
  }));
}

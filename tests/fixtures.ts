import { demoSeed } from '@/storage/demo-seed';
import { snapshotSchema } from '@/domain/schemas';

// Synthetic persistence fixtures ONLY. Never used by the application or live spike.
export function allObjectsFixture() {
  const value = demoSeed(); const stamp = '2026-10-24T00:00:00.000Z';
  value.gifts.push({ id: crypto.randomUUID(), personId: value.people[0].id, inventoryItemId: value.inventory[0].id, itemSource: 'inventory', quantity: 1, giftTitle: 'Fixture only', status: 'planned', operationId: crypto.randomUUID(), createdAt: stamp, updatedAt: stamp });
  value.tasteRuns.push({ id: crypto.randomUUID(), requestStatus: 'unavailable', personId: value.people[0].id, inputSignals: [], qlooEvidence: [], suggestions: [], createdAt: stamp });
  return snapshotSchema.parse(value);
}

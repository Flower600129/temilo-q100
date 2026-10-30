import { emptySnapshot, snapshotSchema, type Snapshot } from '../domain/schemas';

const seedId = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
// Shared documentation/test anchor. The App still uses the real current date.
export const demoReferenceTime = '2026-10-30T12:00:00+08:00';
export function demoSeed(): Snapshot {
  const stamp = '2026-10-24T00:00:00.000Z';
  return snapshotSchema.parse({
    ...emptySnapshot(),
    people: [
      { id: seedId(1), displayName: 'Avery', relationship: 'Friend', interests: [{ label: 'Classic cinema' }, { label: 'Classical music' }], createdAt: stamp, updatedAt: stamp },
      { id: seedId(2), displayName: 'Jordan', relationship: 'Colleague', interests: [{ label: 'Tea culture' }, { label: 'Gardening' }], createdAt: stamp, updatedAt: stamp },
    ],
    occasions: [
      { id: seedId(3), personId: seedId(1), type: 'birthday', label: 'Birthday', monthDay: '11-08', recurrence: 'annual', reminderDaysBefore: [14, 7, 1] },
      { id: seedId(4), personId: seedId(2), type: 'birthday', label: 'Birthday', monthDay: '11-15', recurrence: 'annual', reminderDaysBefore: [14, 7, 1] },
    ],
    wishes: [{ id: seedId(5), owner: { kind: 'person', personId: seedId(1) }, title: 'A creative weekend experience', status: 'active', visibility: 'private', createdAt: stamp, updatedAt: stamp }],
    inventory: ['Artisan tea set', 'Scented candle', 'Silk scarf', 'Handmade notebook'].map((title, index) => ({ id: seedId(10 + index), title, quantity: [3, 5, 2, 4][index], createdAt: stamp, updatedAt: stamp })),
    // No invented Qloo evidence or completed gift operations.
  });
}

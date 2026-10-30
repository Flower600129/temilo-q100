import { createPersonInputSchema, personInputSchema, occasionInputSchema, emptySnapshot, snapshotSchema, type Occasion, type Person, type Snapshot } from './schemas';
import { demoSeed } from '../storage/demo-seed';
import { wishInputSchema, inventoryInputSchema, giftInputSchema, tasteRunSchema, type GiftRecord, type Wish, type InventoryItem, type TasteRun } from './schemas';
import { localDateKey } from './dates';
import { giftInputFromRecord, selectedSources } from './gift-sources';
import { validateOccasionDate } from './gift-context';

export type DataMode = 'personal' | 'demo';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  withLock?<T>(key: string, action: () => Promise<T>): Promise<T>;
}

const queues = new Map<string, Promise<unknown>>();
const keyFor = (mode: DataMode) => `gift-memory-native-v1-${mode}`;

function serialize<T>(key: string, action: () => Promise<T>): Promise<T> {
  const prior = queues.get(key) ?? Promise.resolve();
  const current = prior.catch(() => undefined).then(action);
  queues.set(key, current);
  void current.finally(() => {
    if (queues.get(key) === current) queues.delete(key);
  }).catch(() => undefined);
  return current;
}

export class SnapshotRepository {
  constructor(
    readonly mode: DataMode,
    private readonly storage: KeyValueStore,
    private readonly uuid: () => string,
  ) {}

  private run<T>(action: () => Promise<T>): Promise<T> {
    const key = keyFor(this.mode);
    return serialize(key, () => this.storage.withLock ? this.storage.withLock(key, action) : action());
  }

  private change<T>(action: (snapshot: Snapshot) => T): Promise<T> {
    return this.run(async () => {
      const snapshot = await this.readStored();
      const result = action(snapshot);
      await this.commit(snapshot);
      return result;
    });
  }

  private async readStored(): Promise<Snapshot> {
    const raw = await this.storage.getItem(keyFor(this.mode));
    return raw === null ? emptySnapshot() : snapshotSchema.parse(JSON.parse(raw));
  }

  async read(): Promise<Snapshot> {
    return this.run(() => this.readStored());
  }

  private async commit(snapshot: Snapshot): Promise<void> {
    const value = JSON.stringify(snapshotSchema.parse(snapshot));
    const recoveryKey = `${keyFor(this.mode)}-recovery-r1`;
    if (await this.storage.getItem(recoveryKey) === null) {
      const prior = await this.storage.getItem(keyFor(this.mode));
      // This technical recovery copy is separate from the six business objects.
      // A failed backup aborts the mutation rather than overwriting old records.
      await this.storage.setItem(recoveryKey, prior ?? JSON.stringify(emptySnapshot()));
    }
    await this.storage.setItem(keyFor(this.mode), value);
  }

  async addPerson(input: unknown, operationId = this.uuid()): Promise<Person> {
    const { monthDay, reminderDaysBefore = [30], ...value } = createPersonInputSchema.parse(input);
    return this.run(async () => {
      const snapshot = await this.readStored();
      const existing = snapshot.people.find((person) => person.id === operationId);
      if (existing) {
        const birthday = snapshot.occasions.find((occasion) => occasion.personId === operationId && occasion.type === 'birthday');
        const normalized = (days: number[]) => [...new Set(days)].sort((a, b) => b - a);
        const sameBirthday = monthDay ? birthday?.monthDay === monthDay && JSON.stringify(normalized(birthday.reminderDaysBefore)) === JSON.stringify(normalized(reminderDaysBefore)) : !birthday;
        if (JSON.stringify(personInputSchema.parse(existingProfile(existing))) !== JSON.stringify(value) || !sameBirthday) {
          throw new Error('Operation ID was reused with different data.');
        }
        return existing;
      }

      const now = new Date().toISOString();
      const person: Person = {
        ...value, id: operationId, createdAt: now, updatedAt: now,
      };
      const birthday: Occasion | undefined = monthDay ? {
        id: this.uuid(), personId: person.id, type: 'birthday', label: 'Birthday',
        monthDay, recurrence: 'annual', reminderDaysBefore: [...new Set(reminderDaysBefore)].sort((a, b) => b - a),
      } : undefined;
      const next = snapshotSchema.parse({
        ...snapshot,
        people: [...snapshot.people, person],
        occasions: birthday ? [...snapshot.occasions, birthday] : snapshot.occasions,
      });
      // One SQLite-backed value stores all six collections. A failed write leaves the prior snapshot intact.
      await this.commit(next);
      return person;
    });
  }

  async updatePerson(personId: string, input: unknown): Promise<Person> {
    const value = personInputSchema.parse(input);
    return this.change((snapshot) => {
      const index = snapshot.people.findIndex((person) => person.id === personId);
      if (index < 0) throw new Error('This person no longer exists.');
      const person = { ...value, id: personId, createdAt: snapshot.people[index].createdAt, updatedAt: new Date().toISOString() };
      snapshot.people[index] = person;
      return person;
    });
  }

  async deletePerson(personId: string): Promise<void> {
    await this.change((snapshot) => {
      if (snapshot.gifts.some((gift) => gift.personId === personId) || snapshot.tasteRuns.some((run) => run.personId === personId)) {
        throw new Error('This person has gift or taste history and cannot be deleted. Their records have been kept.');
      }
      snapshot.people = snapshot.people.filter((person) => person.id !== personId);
      snapshot.occasions = snapshot.occasions.filter((occasion) => occasion.personId !== personId);
      snapshot.wishes = snapshot.wishes.filter((wish) => wish.owner.kind !== 'person' || wish.owner.personId !== personId);
    });
  }

  async saveOccasion(personId: string, input: unknown, occasionId = this.uuid()): Promise<Occasion> {
    const value = occasionInputSchema.parse(input);
    return this.change((snapshot) => {
      if (!snapshot.people.some((person) => person.id === personId)) throw new Error('This person no longer exists.');
      const existing = snapshot.occasions.find((occasion) => occasion.id === occasionId);
      if (existing && existing.personId !== personId) throw new Error('This date belongs to another person.');
      if (value.type === 'birthday' && snapshot.occasions.some((occasion) => occasion.personId === personId && occasion.type === 'birthday' && occasion.id !== occasionId)) {
        throw new Error('This person already has a birthday. Edit the existing birthday instead.');
      }
      const occasion: Occasion = { ...value, year: value.recurrence === 'annual' ? undefined : value.year,
        reminderDaysBefore: [...new Set(value.reminderDaysBefore)].sort((a, b) => b - a), id: occasionId, personId };
      snapshot.occasions = [...snapshot.occasions.filter((entry) => entry.id !== occasionId), occasion];
      return occasion;
    });
  }

  async deleteOccasion(personId: string, occasionId: string): Promise<void> {
    await this.change((snapshot) => {
      const existing = snapshot.occasions.find((occasion) => occasion.id === occasionId);
      if (existing && existing.personId !== personId) throw new Error('This date belongs to another person.');
      if (snapshot.gifts.some((gift) => gift.occasionId === occasionId)) throw new Error('This date is linked to gift history and cannot be deleted.');
      snapshot.occasions = snapshot.occasions.filter((occasion) => occasion.id !== occasionId);
    });
  }

  async ensureDemo(): Promise<void> {
    if (this.mode !== 'demo') throw new Error('Demo operation requires demo mode.');
    await this.run(async () => {
      const snapshot = await this.readStored();
      const populated = (['people', 'occasions', 'wishes', 'inventory', 'gifts', 'tasteRuns'] as const)
        .some((name) => snapshot[name].length > 0);
      if (!populated) await this.commit(demoSeed());
    });
  }

  async saveWish(input: unknown, wishId = this.uuid()): Promise<Wish> {
    const value = wishInputSchema.parse(input);
    return this.change((snapshot) => {
      const existing = snapshot.wishes.find((entry) => entry.id === wishId);
      const now = new Date().toISOString();
      const wish: Wish = { ...value, id: wishId, createdAt: existing?.createdAt ?? now, updatedAt: now };
      snapshot.wishes = [...snapshot.wishes.filter((entry) => entry.id !== wishId), wish];
      return wish;
    });
  }

  async deleteWish(wishId: string): Promise<void> {
    await this.change((snapshot) => { snapshot.wishes = snapshot.wishes.filter((entry) => entry.id !== wishId); });
  }

  async saveInventory(input: unknown, itemId = this.uuid(), expectedUpdatedAt?: string): Promise<InventoryItem> {
    const value = inventoryInputSchema.parse(input);
    return this.change((snapshot) => {
      const existing = snapshot.inventory.find((entry) => entry.id === itemId);
      if (existing && existing.updatedAt !== expectedUpdatedAt) throw new Error('This item changed in another operation. Reopen it before adjusting stock.');
      if (!existing && expectedUpdatedAt) throw new Error('This item was removed. Reopen your gift box.');
      const now = new Date().toISOString();
      const item: InventoryItem = { ...value, id: itemId, createdAt: existing?.createdAt ?? now, updatedAt: existing ? nextStamp(existing.updatedAt) : now };
      snapshot.inventory = [...snapshot.inventory.filter((entry) => entry.id !== itemId), item];
      return item;
    });
  }

  async deleteInventory(itemId: string): Promise<void> {
    await this.change((snapshot) => {
      if (snapshot.gifts.some((entry) => entry.inventoryItemId === itemId)) throw new Error('This item has gift records. Keep it with zero stock to preserve history.');
      snapshot.inventory = snapshot.inventory.filter((entry) => entry.id !== itemId);
    });
  }

  async createGift(input: unknown, operationId = this.uuid()): Promise<GiftRecord> {
    const value = giftInputSchema.parse(input);
    return this.change((snapshot) => {
      const existing = snapshot.gifts.find((entry) => entry.operationId === operationId);
      if (existing) {
        if (JSON.stringify(giftInputFromRecord(existing)) !== JSON.stringify(value)) throw new Error('Operation ID was reused with different gift data.');
        return existing;
      }
      if (!snapshot.people.some((entry) => entry.id === value.personId)) throw new Error('This person no longer exists.');
      validateOccasionDate(snapshot, value.personId, value.occasionId, value.occasionDate);
      const now = new Date().toISOString();
      const gift: GiftRecord = { ...value, ...selectedSources(snapshot, value), id: operationId, operationId, status: 'planned', createdAt: now, updatedAt: now };
      snapshot.gifts.push(gift);
      return gift;
    });
  }

  async updateGiftPlan(giftId: string, input: unknown, expectedUpdatedAt: string): Promise<GiftRecord> {
    const value = giftInputSchema.parse(input);
    return this.change((snapshot) => {
      const gift = snapshot.gifts.find((entry) => entry.id === giftId);
      if (!gift || gift.status !== 'planned') throw new Error('This plan is no longer editable. Reopen its record.');
      if (gift.updatedAt !== expectedUpdatedAt) throw new Error('This plan changed in another operation. Reopen it before editing.');
      if (value.personId !== gift.personId) throw new Error('A plan cannot be moved to a different friend.');
      validateOccasionDate(snapshot, value.personId, value.occasionId, value.occasionDate);
      const next: GiftRecord = { ...gift, ...value, ...selectedSources(snapshot, value, gift), updatedAt: nextStamp(gift.updatedAt) };
      // Optional selections removed by an edit must not survive the spread.
      for (const key of ['occasionId', 'occasionDate', 'inventoryItemId', 'note', 'wishId', 'tasteRunId', 'suggestionId'] as const) if (!(key in value)) delete next[key];
      if (!value.wishId) delete next.wishSnapshot;
      if (!value.tasteRunId) delete next.tasteSnapshot;
      snapshot.gifts[snapshot.gifts.indexOf(gift)] = next;
      return next;
    });
  }

  async confirmGift(giftId: string, giftedAt = localDateKey(new Date())): Promise<GiftRecord> {
    return this.change((snapshot) => {
      const gift = snapshot.gifts.find((entry) => entry.id === giftId);
      if (!gift) throw new Error('This gift plan no longer exists.');
      if (gift.status === 'given') return gift;
      if (gift.status === 'cancelled') throw new Error('A cancelled gift cannot be sent again. Create a new plan.');
      if (giftedAt > localDateKey(new Date())) throw new Error('The date given cannot be in the future.');
      const now = new Date().toISOString();
      if (gift.itemSource === 'inventory') {
        const item = snapshot.inventory.find((entry) => entry.id === gift.inventoryItemId);
        if (!item || item.quantity < gift.quantity) throw new Error('Not enough stock. Your plan and inventory have been kept.');
        item.quantity -= gift.quantity; item.updatedAt = nextStamp(item.updatedAt);
      }
      gift.status = 'given'; gift.giftedAt = giftedAt; gift.updatedAt = now;
      return gift;
    });
  }

  async cancelGift(giftId: string): Promise<GiftRecord> {
    return this.change((snapshot) => {
      const gift = snapshot.gifts.find((entry) => entry.id === giftId);
      if (!gift) throw new Error('This gift record no longer exists.');
      if (gift.status === 'cancelled') return gift;
      const now = new Date().toISOString();
      if (gift.status === 'given' && gift.itemSource === 'inventory') {
        const item = snapshot.inventory.find((entry) => entry.id === gift.inventoryItemId);
        if (!item) throw new Error('Inventory item is missing; restoration was not performed.');
        item.quantity += gift.quantity; item.updatedAt = nextStamp(item.updatedAt);
      }
      gift.status = 'cancelled'; gift.updatedAt = now;
      return gift;
    });
  }

  async saveTasteRun(input: unknown): Promise<TasteRun> {
    const run = tasteRunSchema.parse(input);
    return this.change((snapshot) => {
      const existing = snapshot.tasteRuns.find((entry) => entry.id === run.id);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(run)) throw new Error('This exploration ID was reused with different evidence.');
        return existing;
      }
      snapshot.tasteRuns.push(run); return run;
    });
  }

  async updateGiftFeedback(giftId: string, feedback: string): Promise<GiftRecord> {
    if (feedback.length > 2000) throw new Error('Keep your gift feedback within 2,000 characters.');
    return this.change((snapshot) => {
      const gift = snapshot.gifts.find((entry) => entry.id === giftId);
      if (!gift) throw new Error('This gift record no longer exists.');
      if (gift.status !== 'given') throw new Error('Feedback belongs to a gift that has been given.');
      gift.feedback = feedback.trim() || undefined; gift.updatedAt = nextStamp(gift.updatedAt); return gift;
    });
  }

  async resetDemo(): Promise<void> {
    if (this.mode !== 'demo') throw new Error('Only demo data can be reset.');
    await this.run(() => this.commit(demoSeed()));
  }
}

function existingProfile(person: Person) {
  const { displayName, relationship, interests, dislikes, notes } = person;
  return { displayName, relationship, interests, dislikes, notes };
}
function nextStamp(previous: string) { return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString(); }

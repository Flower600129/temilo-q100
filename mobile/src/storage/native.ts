import * as Crypto from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';
import { SnapshotRepository, type DataMode } from '../../../src/domain/snapshot-repository';

const repositories = {
  personal: new SnapshotRepository('personal', Storage, Crypto.randomUUID),
  demo: new SnapshotRepository('demo', Storage, Crypto.randomUUID),
};

export function nativeRepository(mode: DataMode): SnapshotRepository {
  return repositories[mode];
}

export async function readDataMode(): Promise<DataMode> {
  const mode = await Storage.getItem('gift-memory-native-mode-v1');
  if (mode !== null && mode !== 'personal' && mode !== 'demo') throw new Error('Saved data-space preference is invalid. Your records have been preserved.');
  return mode ?? 'personal';
}
export const saveDataMode = (mode: DataMode) => Storage.setItem('gift-memory-native-mode-v1', mode);
export function subscribeToChanges(_listener: () => void): () => void { return () => {}; }

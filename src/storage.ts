export interface StoreAdapter<T> {
  read(key: string): Promise<T | undefined>;
  write(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

class MemoryStore<T> implements StoreAdapter<T> {
  private store = new Map<string, T>();
  async read(key: string): Promise<T | undefined> { return this.store.get(key); }
  async write(key: string, value: T): Promise<void> { this.store.set(key, value); }
  async delete(key: string): Promise<void> { this.store.delete(key); }
}

let globalStore: StoreAdapter<unknown> | null = null;

export function getStore<T>(): StoreAdapter<T> {
  if (!globalStore) globalStore = new MemoryStore<unknown>();
  return globalStore as StoreAdapter<T>;
}

export async function getItem<T>(key: string): Promise<T | undefined> {
  return getStore<T>().read(key);
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  return getStore<T>().write(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  return getStore<unknown>().delete(key);
}

export function userKey(userId: number, suffix: string): string {
  return `user:${userId}:${suffix}`;
}

export function alertKey(userId: number, alertId: string): string {
  return `alert:${userId}:${alertId}`;
}

export function settingsKey(userId: number): string {
  return `settings:${userId}`;
}

export function profileKey(userId: number): string {
  return `profile:${userId}`;
}

export function ownerStatsKey(): string {
  return "owner:stats";
}

export function alertEventsKey(): string {
  return "owner:alert_events";
}

export function userIdIndexKey(): string {
  return "owner:user_ids";
}

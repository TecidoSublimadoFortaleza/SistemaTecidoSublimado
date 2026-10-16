import { pgPool, isPostgresActive, markDatabaseUnavailable } from './postgres';
import { localStore } from './localStore';

export class PersistentArray<T> extends Array<T> {
  constructor(private collectionName: string) {
    super();
  }

  push(...items: T[]): number {
    const result = super.push(...items);

    // Save items to local database file
    for (const item of items) {
      const id = (item as any).id || `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStore.setItem(this.collectionName, id, item);

      if (isPostgresActive()) {
        pgPool.query(
          `INSERT INTO _system_store (collection, id, data) VALUES ($1, $2, $3) ON CONFLICT (collection, id) DO UPDATE SET data = $3`,
          [this.collectionName, id, JSON.stringify(item)]
        ).catch(() => {
          markDatabaseUnavailable();
        });
      }
    }

    return result;
  }
}

import { MongoStore } from './mongoStore.ts';
import { SqliteStore } from './sqliteStore.ts';
import { hashPassword, verifyPassword, type DatabaseStore, type StorageStatus } from './storeTypes.ts';

export { hashPassword, verifyPassword };
export type { DatabaseStore, StorageStatus };

let activeStore: DatabaseStore | null = null;
let storageStatus: StorageStatus = {
  engine: 'SQLite (Local Fallback)',
  configured: false,
  connected: false,
  dbName: process.env.MONGODB_DB_NAME || 'internradar',
  usernameHint: 'rdondlapadu_db_user',
  message: 'Initializing database engine...',
};

function hasUsableMongoUri(uri: string | undefined): uri is string {
  if (!uri) return false;
  const trimmed = uri.trim();
  if (!trimmed) return false;
  if (trimmed.includes('<db_password>') || trimmed.includes('<cluster-host>') || trimmed.includes('<username>')) {
    return false;
  }
  return trimmed.startsWith('mongodb://') || trimmed.startsWith('mongodb+srv://');
}

export async function initDatabase(): Promise<void> {
  if (activeStore) return;

  const mongoUri = process.env.MONGODB_URI;
  const dbName = (process.env.MONGODB_DB_NAME || 'internradar').trim() || 'internradar';

  if (hasUsableMongoUri(mongoUri)) {
    const mongoStore = new MongoStore(mongoUri.trim(), dbName);
    try {
      await mongoStore.init();
      activeStore = mongoStore;
      storageStatus = {
        engine: 'MongoDB Atlas',
        configured: true,
        connected: true,
        dbName,
        usernameHint: 'rdondlapadu_db_user',
        message: `Connected to MongoDB Atlas database "${dbName}".`,
      };
      console.log(`[InternRadar DB] Connected to MongoDB Atlas (${dbName}).`);
      return;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown MongoDB Atlas connection error';
      console.error('[InternRadar DB] MongoDB Atlas connection failed, falling back to local SQLite:', errorMessage);
      try {
        await mongoStore.close();
      } catch {
        // ignore close error
      }
      const sqliteStore = new SqliteStore();
      await sqliteStore.init();
      activeStore = sqliteStore;
      storageStatus = {
        engine: 'SQLite (Local Fallback)',
        configured: true,
        connected: true,
        dbName,
        usernameHint: 'rdondlapadu_db_user',
        message: 'MongoDB Atlas connection failed; running on local SQLite fallback until Atlas is reachable.',
        error: errorMessage,
      };
      return;
    }
  }

  const sqliteStore = new SqliteStore();
  await sqliteStore.init();
  activeStore = sqliteStore;
  storageStatus = {
    engine: 'SQLite (Local Fallback)',
    configured: false,
    connected: true,
    dbName,
    usernameHint: 'rdondlapadu_db_user',
    message:
      'MONGODB_URI is not set yet. Set MONGODB_URI in AI Studio Secrets for user rdondlapadu_db_user to persist all data in MongoDB Atlas.',
  };
  console.log('[InternRadar DB] MONGODB_URI not configured; running on local SQLite fallback (data/internradar.db).');
}

export function getDbStore(): DatabaseStore {
  if (!activeStore) {
    throw new Error('Database store not initialized. Call initDatabase() before handling requests.');
  }
  return activeStore;
}

export function getStorageStatus(): StorageStatus {
  return storageStatus;
}

export async function closeDatabase(): Promise<void> {
  if (activeStore) {
    await activeStore.close();
    activeStore = null;
  }
}

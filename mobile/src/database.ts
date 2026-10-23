import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { Session } from './client';
export type LocalDraft = {
  uuid: string;
  version: number;
  status: string;
  equipment_uuid: string;
  operator_uuid: string;
  work_date: string;
  shift: string;
  condition: string;
  meter_start: string;
  meter_end: string;
  notes: string;
  activities: {
    starts_at: string;
    ends_at: string;
    break_seconds: number;
    description: string;
    location_uuid?: string;
    quantity: string;
    unit: string;
  }[];
  fuel_events: {
    meaning: string;
    quantity: string;
    unit: string;
    fuel_type: string;
    method: string;
    place?: string;
  }[];
  helpers: { person_uuid: string; overtime_minutes: number }[];
};
export type Operation = {
  operation_id: string;
  entity_id: string;
  action: string;
  base_version: number;
  payload_json: string;
  dependency_operation_id: string | null;
  status: string;
  attempt_count: number;
  next_retry_at: number;
  last_error: string | null;
  server_receipt: string | null;
  wire_json: string | null;
};
export type FieldDb = SQLite.SQLiteDatabase;
export async function openScope(session: Session, plantUuid: string): Promise<FieldDb> {
  const scope = `${session.user.id}.${plantUuid}`;
  const keyName = `epita.dbkey.${scope}`;
  let key = await SecureStore.getItemAsync(keyName);
  if (!key) {
    key = Array.from(await Crypto.getRandomBytesAsync(32))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync(keyName, key);
  }
  const db = await SQLite.openDatabaseAsync(`epita.${scope}.db`);
  const cipher = await db.getFirstAsync<Record<string, string>>('PRAGMA cipher_version');
  if (!cipher || !Object.values(cipher).some(Boolean)) {
    await db.closeAsync();
    throw new Error(
      'Build perangkat dengan SQLCipher diperlukan. Expo Go tidak dipakai untuk cache operasional.',
    );
  }
  await db.execAsync(
    `PRAGMA key = "x'${key}'"; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`,
  );
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS cache (name TEXT PRIMARY KEY,payload_json TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS drafts (uuid TEXT PRIMARY KEY,version INTEGER NOT NULL,status TEXT NOT NULL,payload_json TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS outbox (operation_id TEXT PRIMARY KEY,entity_id TEXT NOT NULL,action TEXT NOT NULL,base_version INTEGER NOT NULL,payload_json TEXT NOT NULL,dependency_operation_id TEXT,status TEXT NOT NULL,attempt_count INTEGER NOT NULL DEFAULT 0,next_retry_at INTEGER NOT NULL DEFAULT 0,last_error TEXT,server_receipt TEXT,wire_json TEXT,created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS outbox_queue ON outbox(status,next_retry_at); CREATE TABLE IF NOT EXISTS evidence (uuid TEXT PRIMARY KEY,report_uuid TEXT NOT NULL,local_uri TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,checksum TEXT,status TEXT NOT NULL,server_uuid TEXT,last_error TEXT); CREATE TABLE IF NOT EXISTS changes (entity_id TEXT PRIMARY KEY,payload_json TEXT NOT NULL,deleted INTEGER NOT NULL DEFAULT 0);`,
  );
  await db.runAsync("UPDATE outbox SET status='queued' WHERE status='sending'");
  return db;
}
export async function cacheValue<T>(db: FieldDb, name: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ payload_json: string }>(
    'SELECT payload_json FROM cache WHERE name=?',
    name,
  );
  return row ? JSON.parse(row.payload_json) : null;
}
export async function setCache(db: FieldDb, name: string, value: unknown): Promise<void> {
  await db.runAsync(
    'INSERT INTO cache(name,payload_json,updated_at) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at',
    name,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}
export async function drafts(db: FieldDb): Promise<LocalDraft[]> {
  return (
    await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM drafts ORDER BY updated_at DESC',
    )
  ).map((r) => JSON.parse(r.payload_json));
}
export async function operations(db: FieldDb): Promise<Operation[]> {
  return db.getAllAsync<Operation>('SELECT * FROM outbox ORDER BY created_at');
}
export async function enqueueDraft(db: FieldDb, draft: LocalDraft, submit = false): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const last = await txn.getFirstAsync<Operation>(
      'SELECT * FROM outbox WHERE entity_id=? ORDER BY rowid DESC LIMIT 1',
      draft.uuid,
    );
    if (last && ['conflict', 'invalid', 'blocked', 'auth_required'].includes(last.status))
      throw new Error(
        'Selesaikan masalah sinkronisasi draft ini sebelum membuat operasi berikutnya.',
      );
    if (last?.action === 'submit' && last.status !== 'applied')
      throw new Error(
        'Laporan sudah mengantre untuk dikirim. Tunggu receipt sebelum mengubah isinya.',
      );
    const local = { ...draft, status: submit ? 'queued_submit' : 'local' };
    await txn.runAsync(
      'INSERT INTO drafts(uuid,version,status,payload_json,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(uuid) DO UPDATE SET version=excluded.version,status=excluded.status,payload_json=excluded.payload_json,updated_at=excluded.updated_at',
      draft.uuid,
      draft.version,
      local.status,
      JSON.stringify(local),
      new Date().toISOString(),
    );
    if (
      !submit &&
      last?.status === 'queued' &&
      last.attempt_count === 0 &&
      !last.wire_json &&
      last.action !== 'submit'
    ) {
      await txn.runAsync(
        'UPDATE outbox SET payload_json=? WHERE operation_id=?',
        JSON.stringify(draft),
        last.operation_id,
      );
      return;
    }
    const action = submit
      ? 'submit'
      : !last && draft.version === 0
        ? 'create_draft'
        : 'update_draft';
    await txn.runAsync(
      'INSERT INTO outbox(operation_id,entity_id,action,base_version,payload_json,dependency_operation_id,status,created_at) VALUES(?,?,?,?,?,?,?,?)',
      Crypto.randomUUID(),
      draft.uuid,
      action,
      draft.version,
      JSON.stringify(submit ? { confirmed: true } : draft),
      last?.operation_id ?? null,
      'queued',
      new Date().toISOString(),
    );
  });
}

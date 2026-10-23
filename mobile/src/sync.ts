import { api, ApiError, type Session } from './client';
import { cacheValue, setCache, type FieldDb, type Operation } from './database';
import { failureState, retryDelay } from './retry.mjs';
import { uploadEvidence } from './evidence';
let running = false;
export async function synchronize(db: FieldDb, session: Session): Promise<void> {
  if (running) return;
  running = true;
  try {
    try {
      await api('me', session);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        await db.runAsync(
          "UPDATE outbox SET status='auth_required',last_error='Perlu masuk kembali' WHERE status='queued'",
        );
      throw error;
    }
    const queue = await db.getAllAsync<Operation>(
      "SELECT * FROM outbox WHERE status='queued' AND next_retry_at<=? ORDER BY rowid",
      Date.now(),
    );
    for (const op of queue) {
      let base = op.base_version;
      if (op.dependency_operation_id) {
        const parent = await db.getFirstAsync<Operation>(
          'SELECT * FROM outbox WHERE operation_id=?',
          op.dependency_operation_id,
        );
        if (!parent || parent.status !== 'applied' || !parent.server_receipt) continue;
        base = (JSON.parse(parent.server_receipt) as { version: number }).version;
      }
      if (op.action === 'submit') {
        await uploadEvidence(db, session, op.entity_id);
        const remaining = await db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) as count FROM evidence WHERE report_uuid=? AND status!='applied'",
          op.entity_id,
        );
        if (remaining?.count) continue;
      }
      let envelope: Record<string, unknown>;
      if (op.wire_json) envelope = JSON.parse(op.wire_json);
      else {
        envelope = {
          operation_id: op.operation_id,
          entity_id: op.entity_id,
          entity_type: 'daily_report',
          action: op.action,
          base_version: base,
          payload: JSON.parse(op.payload_json),
          dependency_operation_id: op.dependency_operation_id,
        };
        await db.runAsync(
          'UPDATE outbox SET wire_json=?,base_version=? WHERE operation_id=?',
          JSON.stringify(envelope),
          base,
          op.operation_id,
        );
      }
      await db.runAsync("UPDATE outbox SET status='sending' WHERE operation_id=?", op.operation_id);
      try {
        const response = await api<{
          receipts: { operation_id: string; version: number; status: string }[];
        }>('sync/push', session, { device_id: session.device_id, operations: [envelope] });
        const receipt = response.receipts[0];
        if (!receipt || receipt.operation_id !== op.operation_id)
          throw new Error('Receipt server tidak sesuai operasi.');
        await db.withExclusiveTransactionAsync(async (txn) => {
          await txn.runAsync(
            "UPDATE outbox SET status='applied',server_receipt=?,last_error=NULL WHERE operation_id=?",
            JSON.stringify(receipt),
            op.operation_id,
          );
          const row = await txn.getFirstAsync<{ payload_json: string }>(
            'SELECT payload_json FROM drafts WHERE uuid=?',
            op.entity_id,
          );
          if (row) {
            const draft = JSON.parse(row.payload_json);
            draft.version = receipt.version;
            draft.status = receipt.status;
            await txn.runAsync(
              'UPDATE drafts SET version=?,status=?,payload_json=? WHERE uuid=?',
              receipt.version,
              receipt.status,
              JSON.stringify(draft),
              op.entity_id,
            );
          }
        });
      } catch (error) {
        const status = error instanceof ApiError ? error.status : 0;
        const state = failureState(status);
        await db.runAsync(
          'UPDATE outbox SET status=?,attempt_count=attempt_count+1,next_retry_at=?,last_error=? WHERE operation_id=?',
          state,
          Date.now() + retryDelay(op.attempt_count + 1),
          error instanceof Error ? error.message : 'Koneksi gagal',
          op.operation_id,
        );
        if (status === 409) {
          const server = await api(`daily-reports/${op.entity_id}`, session).catch(() => null);
          if (server) await setCache(db, `conflict.${op.entity_id}`, server);
        }
        if ([401, 403, 409, 422].includes(status)) break;
      }
    }
    let cursor = (await cacheValue<number>(db, 'cursor')) ?? 0;
    let until: number | undefined;
    let more = true;
    while (more) {
      const page = await api<{
        changes: { entity_id: string; payload: unknown; deleted: boolean }[];
        cursor: number;
        until: number;
        has_more: boolean;
      }>(`sync/pull?cursor=${cursor}${until !== undefined ? `&until=${until}` : ''}`, session);
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const change of page.changes) {
          await txn.runAsync(
            'INSERT INTO changes(entity_id,payload_json,deleted) VALUES(?,?,?) ON CONFLICT(entity_id) DO UPDATE SET payload_json=excluded.payload_json,deleted=excluded.deleted',
            change.entity_id,
            JSON.stringify(change.payload),
            change.deleted ? 1 : 0,
          );
        }
        await txn.runAsync(
          'INSERT INTO cache(name,payload_json,updated_at) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at',
          'cursor',
          JSON.stringify(page.cursor),
          new Date().toISOString(),
        );
      });
      cursor = page.cursor;
      until = page.until;
      more = page.has_more;
    }
    await setCache(db, 'last_sync', new Date().toISOString());
  } finally {
    running = false;
  }
}

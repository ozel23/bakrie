import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import type { FieldDb } from './database';
import type { Session } from './client';
export async function storeEvidence(
  db: FieldDb,
  reportUuid: string,
  uri: string,
  name: string,
  mime: string,
): Promise<void> {
  const id = Crypto.randomUUID();
  const folder = new Directory(Paths.document, 'epita-evidence');
  folder.create({ idempotent: true, intermediates: true });
  const destination = new File(folder, `${id}.${mime === 'image/png' ? 'png' : 'jpg'}`);
  new File(uri).copy(destination);
  const bytes = await destination.bytes();
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  const checksum = Array.from(new Uint8Array(digest))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
  await db.runAsync(
    'INSERT INTO evidence(uuid,report_uuid,local_uri,name,mime,checksum,status) VALUES(?,?,?,?,?,?,?)',
    id,
    reportUuid,
    destination.uri,
    name,
    mime,
    checksum,
    'queued',
  );
}
export async function uploadEvidence(
  db: FieldDb,
  session: Session,
  reportUuid: string,
): Promise<void> {
  const evidence = await db.getAllAsync<{
    uuid: string;
    local_uri: string;
    name: string;
    mime: string;
    checksum: string;
  }>("SELECT * FROM evidence WHERE report_uuid=? AND status!='applied'", reportUuid);
  for (const item of evidence) {
    try {
      const body = new FormData();
      body.append('report_uuid', reportUuid);
      body.append('attachment_uuid', item.uuid);
      body.append('checksum', item.checksum);
      body.append('file', {
        uri: item.local_uri,
        name: item.name,
        type: item.mime,
      } as unknown as Blob);
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '')}/attachments`,
        {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Bearer ${session.token}` },
          body,
          signal: AbortSignal.timeout(60000),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'Unggahan foto gagal.');
      if (result.checksum !== item.checksum) throw new Error('Checksum foto server berbeda.');
      await db.runAsync(
        "UPDATE evidence SET status='applied',server_uuid=?,last_error=NULL WHERE uuid=?",
        result.uuid,
        item.uuid,
      );
    } catch (error) {
      await db.runAsync(
        "UPDATE evidence SET status='queued',last_error=? WHERE uuid=?",
        error instanceof Error ? error.message : 'Foto belum terunggah',
        item.uuid,
      );
      throw error;
    }
  }
}

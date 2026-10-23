# API EPITA v1

Base path `/api/v1`. Endpoint terproteksi menggunakan `Authorization: Bearer <token-perangkat>`. Akses akun nonaktif ditolak. Scope dan permission selalu diperiksa di server. Respons memiliki `X-Request-ID`. JSON error menggunakan `message` serta `errors` per field jika tersedia.

Dokumen menggambarkan source existing yang dibaca, bukan pengujian endpoint perusahaan. Lihat [indeks](00-INDEX.md), [audit F-01–F-10](FINAL-AUDIT.md) dan [kontrak caller web](FRONTEND-CONTRACT.md). Jangan menyamakan dukungan filter web dengan semua daftar API.

## Autentikasi dan bootstrap

| Method | Path | Kontrak |
|---|---|---|
| POST | auth/login | email, password, device_id UUID; menghasilkan token, user, offline_until |
| GET | me | identitas pengguna, plant_ids, server_time |
| POST | auth/logout | mencabut token perangkat |
| GET | bootstrap?plant=UUID | master/penugasan/laporan scoped, plant, cursor awal, offline_until |

Lease offline default usulan tujuh hari (`EPITA_OFFLINE_DAYS`). Pengesahan organisasi dan uji perangkat tetap diperlukan. Tidak ada endpoint registrasi publik.

Bootstrap mengirim Plant existing termasuk `timezone`. Keputusan pengguna adalah zona waktu masing-masing plant; web sudah memakai identifier ini, mobile masih memiliki WIB/+07 dan belum diperbaiki pada tahap frontend. Timestamp tetap ISO ber-offset/UTC; work_date tetap kalender plant.

**F-04, risiko source:** bootstrap membaca snapshot sebelum MAX(server_changes.id), tanpa bukti snapshot/high-water atomik. Commit di antara dua pembacaan berpotensi terlewati cursor. Belum ada reproduksi concurrency SQL Server. Backend harus membuktikan perubahan masuk snapshot atau pull berikutnya dengan test dua koneksi/barrier; urutan cursor tidak diubah pada tahap ini. Batas high-water `until` pada pull yang sudah ada tetap dipertahankan.

## Operasional

| Method | Path | Keterangan |
|---|---|---|
| GET / POST | daily-reports | daftar berhalaman / buat draft |
| GET / PATCH | daily-reports/{uuid} | baca / simpan revisi draft |
| POST | daily-reports/{uuid}/submit | version + confirmed=true |
| POST | daily-reports/{uuid}/review | version |
| POST | daily-reports/{uuid}/return | version + reason wajib |
| POST | daily-reports/{uuid}/approve | version, bukan pembuat/operator |
| POST | daily-reports/{uuid}/fuel-verifications | version, fuel_uuid, meaning, method, reason |
| GET | assignments | daftar tugas sesuai akses |
| GET | equipment/{uuid} | detail equipment sesuai plant |
| GET / POST | breakdowns | daftar / laporan kerusakan |
| GET / POST | maintenance-orders | daftar / WO corrective atau preventive |
| POST | maintenance-orders/{uuid}/actions | version, technician_uuid, timestamps, description, result, parts[] |
| POST | maintenance-orders/{uuid}/release | version, functional_test, safety_check, notes |
| POST | attachments | multipart report_uuid, attachment_uuid opsional, checksum SHA256 opsional, file |
| GET | attachments/{uuid} | download privat mengikuti akses laporan |
| GET | dashboard | snapshot scoped; belum merupakan API KPI lengkap |

### Dukungan filter daftar saat audit — F-03

Semua resource memakai plant scope, aturan owner dan pagination `page`, `per_page` (default20, maksimum100). `WorkspaceFilterRequest` memvalidasi parameter tambahan, tetapi validasi tidak berarti query menerapkannya.

| Resource | Query filter yang ditemukan | Keterbatasan existing |
|---|---|---|
| daily-reports | `WorkspaceData::reports`: period, status, q, equipment_uuid, operator_uuid | Tetap perlu test kombinasi/scope pada SQL Server |
| assignments | plant + operator terkait akun untuk own-only | period/status/q/equipment_uuid/operator_uuid yang dikirim belum diterapkan |
| breakdowns | plant + reported_by untuk own-only | Filter tambahan di atas belum diterapkan |
| maintenance-orders | plant + equipment dari penugasan akun untuk own-only | Filter tambahan di atas belum diterapkan |

Konsumen API tidak boleh mengasumsikan hasil tiga resource terakhir sudah terfilter. Backend B13 harus menerapkan dukungan yang disepakati atau menolak parameter unsupported secara eksplisit, lalu menguji IDs+total pada dua periode/status/owner. Ini backlog, bukan perubahan endpoint yang sudah diterapkan. Filter `{resource}_page/per_page` dan category/condition/meaning untuk halaman web tidak otomatis menjadi kontrak semua resource mobile.

Draft minimal:

```json
{
  "uuid": "UUID-laporan-client",
  "version": 0,
  "equipment_uuid": "UUID-equipment",
  "operator_uuid": "UUID-personel",
  "work_date": "2026-10-01",
  "shift": "utama",
  "condition": "working",
  "meter_start": "10023.000",
  "meter_end": "10030.000",
  "notes": "",
  "activities": [],
  "fuel_events": [],
  "helpers": []
}
```

UUID contoh di atas adalah label kontrak; kirim UUID valid dari bootstrap. `version:0` hanya saat create. Update dan setiap transisi memerlukan versi server terbaru. Status, totals, scope, actor, dan approval tidak diambil dari nilai client.

Aktivitas: starts_at / ends_at ISO 8601 dengan offset, break_seconds integer, description, location_uuid opsional, plan_item_uuid opsional, quantity string DECIMAL dan unit terpisah, serta informasi rute/muatan/meter sesi bila berlaku. API tidak menganggap HM sama dengan durasi timestamp.

Fuel: meaning (`unverified`, `receipt`, `consumption`), quantity string, unit (`L`/`KG`), fuel_type, method (`direct`, `stock_balance`, `estimate`), place. Metode stok/estimasi membutuhkan bukti dan pengesahan; workflow pengukuran dan parameter lengkap belum selesai. Semua fuel membutuhkan pemeriksaan sebelum approval final.

## Sinkronisasi

POST `sync/push`:

```json
{
  "device_id": "UUID-perangkat",
  "operations": [{
    "operation_id": "UUID-operasi-stabil",
    "entity_type": "daily_report",
    "entity_id": "UUID-laporan-client",
    "action": "create_draft",
    "base_version": 0,
    "payload": {},
    "dependency_operation_id": null
  }]
}
```

Action yang diimplementasikan: create_draft, update_draft, submit. Isi payload mengikuti kontrak draft atau `{ "confirmed": true }` untuk submit. Maksimal 25 operasi per batch. Setiap operasi atomik; bila operasi berikutnya gagal, operasi sebelumnya yang sudah berhasil tetap memiliki receipt dan dapat di-replay. Payload wire harus dipertahankan identik setelah upaya pertama.

Replay identik mengembalikan receipt yang sama. UUID operasi yang sama dengan envelope/payload berbeda menghasilkan 409. Receipt memuat operation_id, entity_id, version, status, applied_at dan receipt_hash. Client tidak membuat UUID baru untuk timeout dari payload yang sama.

GET `sync/pull?cursor=0&until=...`: server menetapkan high-water cursor untuk satu rangkaian halaman. Respons memuat changes[], cursor, until, has_more. Maksimal 100 perubahan per halaman. Scope dan owner diperiksa ulang pada setiap pull. Infrastruktur tombstone tersedia; lifecycle penghapusan dan change feed master lengkap belum ditutup.

Source mobile mempertahankan `wire_json`/operation ID sesudah upaya pertama dan memulihkan outbox `sending` menjadi `queued` saat DB dibuka. Test crash/replay native tetap diperlukan. **F-10:** adapter mobile saat ini mengganti JSON parse gagal dengan object message dan masih mengembalikannya bila HTTP200. Pemilik mobile perlu guard respons sebelum menyimpan token/cache/receipt/cursor, termasuk redirect, HTML, null, field hilang dan identitas mismatch. Perilaku ini belum diperbaiki oleh tahap frontend web.

## Error

401: login ulang; 403: akses dicabut/tidak cukup; 409: versi/identitas/dependency konflik; 422: koreksi field; 429: rate limit; 503: penyimpanan server belum tersedia. Network / 5xx dapat dicoba ulang dengan operation ID dan wire payload yang sama. Jangan retry otomatis tanpa batas pada 401/403/409/422.

## Web

Route `/workspace/actions/{action}` memakai session + CSRF dan service yang sama. Respons berisi snapshot layar serta `mutation: {uuid, version}` agar form memakai versi hasil penyimpanan. Field tambahan ini tidak mengubah kontrak endpoint mobile.

GET `/app/{page}` menerima `plant`, `period` (Y-m), `q`, `status`, `equipment_uuid`, `operator_uuid`, kategori/kondisi equipment, serta `{resource}_page` dan `{resource}_per_page` (8/15/30). Respons Inertia memuat `snapshot.pagination`, `snapshot.metrics` dari agregasi seluruh periode, referensi master scoped dan baris halaman. Total daftar berasal dari query server.

POST `/workspace/report-preview` dan `/workspace/export` menerima `format`, `start_date`, `end_date`, `status`, `equipment_uuid`, `operator_uuid`, `plant_uuid`; export menambah `output` pdf/xlsx. Dataset client tidak menjadi sumber dokumen. Izin export dan identitas filter dalam plant diperiksa server. Pratinjau mengembalikan maksimal 100 baris utama dan 50 per bagian dengan `total_rows`; ringkasan dan file akhir menggunakan hasil lengkap. PDF besar memakai writer vektor untuk menghindari DOM tabel besar. Ekspor sangat besar masih memerlukan queue/streaming serta uji kapasitas.

Route workspace sintetis `/preview/*` telah dihapus dan mengembalikan 404. Label bisnis seperti “Belum diverifikasi” tetap dipertahankan. Gangguan penyimpanan mengembalikan 503 dan request ID; benturan constraint/version mengembalikan 409. Detail SQL, host, binding dan credential tidak dikirim ke pengguna.

# Handover backend EPITA Bakrie

23 Oktober 2026. Pemilik frontend: pekerjaan tahap ini. Pemilik backend, SQL Server dan server perusahaan: pengembang yang ditunjuk pengguna. Tidak ada pengiriman dokumen ke pihak lain. Ini bahan serah terima lokal untuk ditinjau.

## Mulai dari sini

1. Baca [indeks/precedence](00-INDEX.md) dan [audit final](FINAL-AUDIT.md): 17 modul, O-01–16, temuan F-01–10 dan status bukti. Lalu baca [kontrak frontend](FRONTEND-CONTRACT.md): halaman/action/service, payload setiap form, respons, error, permission dan perilaku UI.
2. Baca [API mobile existing](API.md), [arsitektur source](ARCHITECTURE.md), [PRD](01-PRD-EPITA.md), dan [daftar uji SQL Server](SQL-SERVER-CHECKLIST.md).
3. Audit service/route yang sudah ada; jangan menganggap implementasi di source sebagai backend siap perusahaan. Selesaikan dependency di bawah dan sepakati perubahan kontrak sebelum mengubah frontend.

Tahap ini mempertahankan React/TypeScript/Inertia. Target backend yang diserahterimakan: Laravel 13, PHP 8.4.27, SQL Server. Mobile existing React Native menggunakan SQLite lokal dan API Laravel yang sama; penerapan SQLCipher/native masih perlu uji perangkat. Frontend tidak memasang runtime, mengganti koneksi, menjalankan migrasi/seed/provisioning/worker/scheduler/deploy atau menghubungi server perusahaan.

## Status bukti

| Label | Arti |
|---|---|
| Ditemukan | Route/class/schema ada pada source yang diaudit |
| Dibaca | Aturan ditelusuri pada source, belum dijalankan di perusahaan |
| Diuji frontend | Adapter atau render komponen diuji terisolasi, tanpa backend/database |
| Historis lokal | Hasil pengujian tahap sebelumnya; bukan pelaksanaan backend pada tahap ini |
| Menunggu perusahaan | Kredensial sah, akun, data asli, environment atau UAT belum tersedia |
| Usulan | Perubahan kontrak yang harus disepakati kedua pihak |

Login perusahaan belum dapat dipakai pada environment lokal yang sedang ditinjau karena SQL Server/akun belum tersedia. UI tidak menyediakan sesi pengganti. Rekam sintetis di database tidak diperiksa karena tidak ada akses database yang dijalankan; jangan menyimpulkan database bersih hanya dari audit bundle. Fixture/factory pengujian tetap terisolasi.

## Sumber implementasi yang harus ditinjau backend

| Area | File utama / tanggung jawab |
|---|---|
| Routing/session | `routes/web.php`, `AuthController`, `EnsureActiveUser`, `HandleInertiaRequests`, `bootstrap/app.php` |
| Scope | `app/Services/Access.php`, `Membership`, `User`, `Plant` |
| DTO/query/KPI | `WorkspaceController`, `WorkspaceFilterRequest`, `app/Services/WorkspaceData.php` |
| Laporan/approval/BBM | `ReportWorkflow.php`, `Measurements.php` |
| Rencana | `PlanningService.php` |
| Maintenance | `MaintenanceService.php` |
| Impor/SAP | `WorkbookImporter.php`, `app/Jobs/ParseWorkbook.php` |
| Dokumen | `ExportService.php`, `PdfTableWriter.php`, `resources/views/exports/` |
| Mobile/sync | `routes/api.php`, `Api/V1/OperationsController.php`, `SyncService.php`, `mobile/src/{client,sync,database,evidence,retry}.*` |
| Schema | `database/migrations/2026_10_22_071304_create_epita_domain.php`, additive query indexes, users/tokens/jobs/cache migrations |

Nama controller/service ada di source, bukan pengesahan perilaku SQL Server. Semua perubahan pada daftar ini dikerjakan backend di tahap berikutnya, bukan di tahap frontend ini.

## Identitas, permission dan batas plant

Akun harus aktif, company/plant aktif dan membership aktif. Satu pengguna dapat memiliki beberapa role; permission adalah union membership pada plant aktif. GET halaman dan setiap mutasi/export/download/job wajib memeriksa scope kembali, tidak bergantung menu yang disembunyikan React. Tidak ada registrasi publik. Backend menyediakan akun perusahaan dan hubungan `people.user_id` secara sah.

| Role konfigurasi existing | Permission yang dibaca |
|---|---|
| operator | read, report-own, breakdown |
| supervisor | read, plan, approve, fuel-verify, breakdown, export |
| assistant | read, plan, approve, fuel-verify, export |
| clerk | read, report-delegate, import, export |
| maintenance | read, breakdown, maintain, release, export |
| manager | read, export |
| admin | read, master, users, import, export |

`users` permission ada, tetapi UI/endpoint administrasi akun lengkap belum tersedia. Operator hanya mengakses data terkait penugasan/laporannya; field operator bukan otorisasi. Pembuat/operator tidak menyetujui atau memverifikasi BBM sendiri. Frontend belum menerima capability per record yang mengungkap hak pembuat; server tetap menolak self-approval. Tentukan DTO capability jika diperlukan, jangan mengirim data akun lain untuk menebak hak tersebut.

## Entitas dan relasi existing

| Kelompok tabel yang ditemukan | Relasi / kebutuhan pemeriksaan |
|---|---|
| users, companies, plants, memberships, people | user ↔ membership ↔ plant → company; Person.user_id nullable, orang dapat bukan akun |
| equipment, locations | Identitas per plant, code unik per plant; location.parent_id self relation; kondisi unknown sah |
| work_plans, plan_items, assignments | Rencana → item → assignment opsional; assignment punya equipment/operator dan interval |
| daily_reports, report_activities, report_people | Laporan unik alat/tanggal/shift; detail urutan sesi, helper/operator dan lembur |
| fuel_events, stock_measurements | Makna/method/verified_by/verified_at/reason terpisah; schema stok awal bukan bukti workflow neraca stok selesai |
| approval_events, reporting_periods, audit_events | Versi/snapshot keputusan, kunci periode dan audit; actor dari server |
| breakdowns, maintenance_orders, maintenance_actions, maintenance_parts, downtime_intervals | Maintenance terpisah dari VRA; interval blokir bisa tumpang tindih |
| attachments | Laporan, pengunggah, private path, MIME/size/checksum, UUID/version |
| import_batches, import_rows, sap_confirmations | File/checksum/plant/kind, raw/normalized/sheet/baris, confirmation+counter+version+payload hash |
| sync_receipts, server_changes, personal_access_tokens | UUID operasi per user/perangkat, receipt hash dan cursor/high-water; token perangkat |
| jobs, job_batches, failed_jobs, sessions/cache sesuai konfigurasi | Infrastruktur antrean/session/cache, bukan data bisnis |

Semua identity domain memakai BIGINT internal + UUID publik + version + timestamps sesuai migration. Nilai fisik DECIMAL(18,3), detik integer; tanggal kerja dan UTC timestamp berbeda. Foreign key dan index harus diuji pada SQL Server. Nonaktif master mempertahankan histori. Jangan menghapus data historis, menjalankan migrate:fresh terhadap perusahaan atau menebak record sintetis dari nama generik.

Gap schema/flow yang sudah diketahui: kalender/shift konfigurabel, helper assignment, ledger reset meter/amendment final, opening balance mesin yang disahkan, parameter estimasi berversi, alokasi SAP/cancellation links/reconciliation runs+resolutions, administration users/roles lengkap, serta export jobs. UI tidak menciptakan field/endpoint palsu untuk menutupi gap ini.

## Pekerjaan konkret pengembang backend

| ID / prioritas | File / alasan | Kontrak dan hasil yang diharapkan |
|---|---|---|
| B01 / penghambat | AuthController, Access, Membership, lingkungan server; belum ada SQL/akun perusahaan | Login session+CSRF → dashboard plant berizin; akun nonaktif/tanpa membership dijelaskan; provisioning privat oleh pemilik backend |
| B02 / penghambat | WorkspaceData, WorkspaceController; DTO layar harus lengkap | Props dan acknowledgment S1 pada kontrak; pagination/metrics/cutoff sah; UUID/status/version hasil server; fixture bukan fallback |
| B03 / penghambat | bootstrap/app.php, RequestId, middleware/session; error Inertia/JSON berbeda | Envelope E1 untuk JSON, halaman error Inertia yang aman, 401/419/429/5xx konsisten, X-Request-ID; jangan bocorkan SQL/host/secret |
| B04 / tinggi | F-02; keputusan pengguna: zona masing-masing plant. Web telah memakai Plant.timezone existing, dua arah dan detik; mobile masih WIB/+07 | Backend memastikan timezone IANA valid selalu ada; pemilik mobile menerapkan keputusan yang sama. Uji instant UTC sama di WIB/WITA/WIT, lintas malam, work_date/period tetap, web→API→export→native; jangan mengubah tanggal kerja diam-diam. |
| B05 / tinggi | ReportWorkflow, PlanningService, MaintenanceService; locking bergantung SQL Server | Transaksi/rollback/version check/self-approval/periode/overlap/downtime diuji serentak; immutable final, no meter regression |
| B06 / tinggi | WorkspaceController::attach, storage local, attachments | Private disk persisten, MIME/size/checksum, replay UUID stabil, akses ulang saat download; tangani orphan file dan kegagalan storage/DB secara konsisten |
| B07 / tinggi | ParseWorkbook, WorkbookImporter, import_rows/sap_confirmations | Worker benar-benar memproses, status job terminal/failed, raw provenance utuh, dedup per plant/kind/checksum, scope dievaluasi ulang saat job jalan |
| B08 / tinggi | SAP mapping/allocation/cancellation/reconciliation belum lengkap | Perlu workbook/foto asli dan aturan pemilik proses; tandai unresolved; jangan jadikan upload sebagai hasil rekonsiliasi final atau posting MM |
| B09 / tinggi | F-09; ExportService, documentData, PdfTableWriter; matriks O-01–16 pada audit final | Lengkapi stok mesin dari sumber sah, jam/solar/rasio kumulatif, hierarchy lokasi/model/kapasitas/main/sub, helper/signers/rekap yang kurang. Preview/Excel/PDF satu filter/sumber lengkap. Code `00123` dan `2026-10-01` tetap string pada kolom code (writer kini mengenali tanggal berdasarkan bentuk nilai). Buka hasil baru, cocokkan foto sah; queue/streaming besar menunggu kontrak job. Artefak QA lama bukan penerimaan source terbaru. |
| B10 / tinggi | OperationsController, SyncService, mobile client | Kontrak UUID/version/receipt tetap; replay identik aman, payload berbeda409, scope/revocation/device lease; uji native/foto nyata/SQLCipher |
| B11 / lanjutan | Account capabilities, user admin, calendar/shift, helper assignment, amendment/reset/stock | Prioritaskan bersama pemilik proses; implementasi dan DTO baru harus disepakati; frontend tidak memanggil endpoint yang belum ada |
| B12 / kapasitas | WorkspaceData::screen/snapshot/documentData, reference master | KPI/exports bukan subset daftar. Uji >500 report/>100 plan/>200 WO dan 100k aktivitas; query/pagination/index, memori, P95, private downloads serta pagination referensi bila perlu |
| B13 / tinggi | F-03; OperationsController::index: filters divalidasi tetapi query assignment/breakdown/WO tidak menerapkannya | Sepakati filter per resource; terapkan atau tolak unsupported secara eksplisit. Dua periode/status/plant/owner dan kombinasi q/equipment/operator/interval harus menghasilkan IDs+total tepat, bukan hanya HTTP200. Pertahankan own-only scope dan filtered daily-reports. |
| B14 / penghambat sync | F-04; OperationsController::bootstrap snapshot sebelum MAX(cursor); risiko source belum direproduksi | Strategi snapshot/high-water konsisten pada SQL Server. Test dua koneksi/barrier: pause sesudah snapshot, commit perubahan, lanjut cursor/pull; event harus masuk snapshot atau pull berikutnya. Uji pagination/restart/revocation; jangan sekadar memindah pembacaan cursor tanpa bukti. |
| B15 / tinggi | F-10; mobile/src/client.ts mengembalikan object pesan saat parse200 gagal | Guard per respons login/bootstrap/me/push/pull sebelum save token/cache/receipt/cursor. Test HTML/redirect/null/JSON rusak/missing identity/mismatched receipt. Jangan menandai authenticated/applied atau memajukan cursor pada payload invalid; outbox/opID/wire tetap. |

## Server perusahaan dan environment

Bagian ini daftar pekerjaan backend, bukan perintah yang dijalankan pada tahap frontend. Persiapkan PHP 8.4.27/Laravel 13 sesuai lockfile, ekstensi pdo_sqlsrv/sqlsrv dan ODBC kompatibel, BCMath/mbstring/XML/DOM/ZIP, SQL Server terenkripsi dengan validasi sertifikat, webroot public, storage privat persisten, antrean dan failed-job monitoring, scheduler, log ber-request ID tanpa credential, HTTPS/session cookie, backup SQL Server beserta file privat dan latihan restore. Database pengujian terpisah dari perusahaan. Sebelum migrasi: inventaris schema, backup/pemulihan dan review migration/status/pretend oleh pengembang backend. Tidak ada auto-deploy di bahan ini.

| Nama environment pada source | Penjelasan, tanpa nilai nyata |
|---|---|
| APP_NAME, APP_ENV, APP_URL, APP_DEBUG | Identitas, environment, URL canonical, kebijakan detail error |
| APP_KEY | Kunci aplikasi privat; jangan kirim melalui frontend atau dokumen |
| APP_LOCALE, APP_FALLBACK_LOCALE | Bahasa UI/validasi |
| DB_CONNECTION | Driver SQL Server tujuan |
| DB_URL | Alternatif URL koneksi bila dipakai backend; secret, jangan hardcode |
| DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD | Endpoint/identitas database di secret environment backend |
| DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE, DB_LOGIN_TIMEOUT | Enkripsi, verifikasi sertifikat, timeout login DB |
| SESSION_DRIVER, SESSION_LIFETIME, SESSION_CONNECTION, SESSION_STORE | Session storage/lifetime sesuai topologi |
| SESSION_DOMAIN, SESSION_PATH, SESSION_SECURE_COOKIE, SESSION_HTTP_ONLY, SESSION_SAME_SITE, SESSION_ENCRYPT | Cakupan dan proteksi cookie/session; tinjau HTTPS/reverse proxy oleh backend |
| FILESYSTEM_DISK | Default disk; handler bukti/impor existing secara eksplisit memakai local private disk |
| QUEUE_CONNECTION, DB_QUEUE_CONNECTION, DB_QUEUE_TABLE, DB_QUEUE, DB_QUEUE_RETRY_AFTER | Antrean; sesuaikan timeout worker/retry secara konsisten |
| CACHE_STORE, CACHE_PREFIX | Cache/rate limit, namespace sesuai deployment |
| LOG_CHANNEL, LOG_STACK, LOG_LEVEL | Kanal/level dan retensi log yang ditetapkan pengelola |
| EPITA_OFFLINE_DAYS | Lease offline mobile; angka default source bukan pengesahan kebijakan perusahaan |
| SANCTUM_STATEFUL_DOMAINS | Pertimbangan domain API stateful, bila diperlukan topologi yang disepakati; bukan pengganti session web |
| REDIS_* / AWS_* | Hanya bila provider dipilih; tidak diasumsikan aktif. Memerlukan scope/secret backend. Bukti belum otomatis berpindah S3 hanya karena FILESYSTEM_DISK berubah. |
| VITE_APP_NAME | Nilai publik frontend. Jangan menaruh secret pada variabel VITE_* |

## Kompatibilitas mobile dan idempotency

Web tidak memakai bearer token. Mobile memakai `/api/v1/auth/login` (email/password/device_id UUID), Sanctum device token, bootstrap scoped dan lease offline. `sync/push` maksimal25 operasi: operation_id, entity_type=daily_report, entity_id, action=create_draft/update_draft/submit, base_version, payload dan dependency_operation_id. Wire payload/UUID operasi tetap saat retry. Receipt memiliki operation_id/entity_id/version/status/applied_at/receipt_hash; identitas sama dengan payload berbeda409. `sync/pull` menjaga until/high-water untuk rangkaian halaman. Kebutuhan tombstone/master change feed dan native revoke/cache lifecycle tetap perlu dituntaskan. Detail rujukan [API.md](API.md).

Recovery `sending→queued` sudah ada saat DB mobile dibuka (`database.ts:75`); jangan dilaporkan hilang atau dibuat operation ID baru untuk timeout. Test crash sesudah commit server/sebelum ack harus menghasilkan replay receipt sama dan tepat satu mutasi. Perbaikan F-04/F-10 dan keputusan timezone mobile tetap diperlukan; 3 test retry/lease yang lulus tidak membuktikan jalur native ini.

## Acceptance matrix serah terima

| ID | Pemeriksaan / expected | Bukti tahap frontend | Tanggung jawab lanjutan |
|---|---|---|---|
| A01 | Tanpa akun/role pengganti/generator di bundle produk | Audit source/bundle | Audit data perusahaan/provenance oleh backend |
| A02 | Login/error/help tampil dan field terbaca | Render terisolasi + browser lokal | Akun perusahaan/session/logout UAT |
| A03 | 200 rusak/HTML login tidak menjadi sukses | Test adapter | Respons nyata reverse proxy/error server |
| A04 | 401/403/404/409/419/422/429/5xx dibedakan, reference tersedia | Test adapter; render field ARIA | Middleware/headers Inertia dan session nyata |
| A05 | Mutasi harus punya UUID/versi; stale/identity tidak ditimpa | Guard frontend dan test | Dua browser serentak, SQL locking/rollback |
| A06 | KPI/total bukan subset page; unknown tidak nol | Test count105/unknown/null/0 | Data SQL nyata >500/100/200 dan 100k aktivitas |
| A07 | Form gagal mempertahankan input dan field errors | Komponen/adapter ditinjau; form render | Browser dengan server422/409 dan upload terputus |
| A08 | Scope lintas plant/operator/export/bukti/job aman | Menu sesuai permission; backend dibaca | UAT lintas akun, scope dicabut saat job antre |
| A09 | Report multitrip/sesi, continuity, unit dan pernyataan benar | Form existing dipertahankan | Workflow/decimal/periode/selfapproval di SQL Server |
| A10 | BBM ambiguous tidak final/receipt ≠ consumption | Label dan form dipertahankan | Pemeriksa lain, seluruh fuel verified, stock/estimate policies |
| A11 | WO/part/rilis dan downtime terpisah VRA | Form/module render | Rilis multi-blocker/teknisi/part/transaksi serentak |
| A12 | Private evidence/replay UUID/partial upload jujur | Adapter multipart/guard/file progress | MIME/checksum/storage failures, scoped download/perangkat |
| A13 | Impor queued bukan final; rows/provenance/status | UI dan adapter | Worker, workbook asli, duplicates/cancellation/mapping |
| A14 | 12 format existing/4 template; output binary bukan halaman login | Adapter MIME tepat/signature; 4 artefak QA historis dibuka, belum disahkan | Tutup matriks O-01–16, file baru/foto asli, typed code/date, saldo/kumulatif dan volume besar |
| A15 | Mobile UUID/lease/conflict tidak diubah | Source mobile dibiarkan | Test perangkat, SQLCipher, foto/revoke/offline sync |
| A16 | Desktop/tablet/mobile/dialog/tabel/error tidak terpotong | Render fixture hanya dalam test; rincian QA pada laporan implementasi | Interaksi lengkap dan keyboard/perangkat perusahaan |
| A17 | PHP/backend/env/database/server tidak diubah tahap ini | Banding hash baseline file di luar scope | Backend mengelola implementasi/deployment berikutnya |
| A18 | Zona per plant konsisten, tanggal kerja tidak bergeser | Web roundtrip WIB/WITA/WIT/detik/lintas malam/invalid-DST terisolasi lulus | B04 mobile dan SQL/export/native UAT |
| A19 | Snapshot lengkap; empty grup PHP bukan error/fallback | Guard metrics/nested records dan normalisasi dua bucket, test SSR lulus | DTO nyata kosong/terisi dan mutasi sesuai kontrak B02 |
| A20 | API list menerapkan filter yang dijanjikan | F-03 source dibaca; support matrix API diperjelas | B13 query/integration IDs+total |
| A21 | Bootstrap tidak melewati event concurrent | F-04 risiko source didokumentasikan; belum reproduction | B14 SQL Server interleaving wajib |
| A22 | Mobile tidak menyimpan respons200 rusak | F-10 source dibaca, belum test native | B15 guard+test; stable wire dan crash replay dipertahankan |

Perubahan kontrak dan hasil UAT dicatat kedua pengembang sebelum pilot. Persetujuan go-live milik organisasi setelah backend dan environment perusahaan teruji; keberadaan source/backend lokal tidak memenuhi syarat tersebut.

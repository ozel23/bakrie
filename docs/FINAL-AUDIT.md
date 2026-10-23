# Audit final struktur dan serah terima EPITA Bakrie

23 Oktober 2026. Ruang lingkup: audit source seluruh struktur, kemudian perbaikan frontend dan dokumentasi yang diotorisasi. Laravel, database, konfigurasi, runtime, template Blade dan mobile tidak diubah. Database perusahaan ditunda sesuai instruksi pengguna. Mulai dari [indeks acuan](00-INDEX.md), [kontrak web](FRONTEND-CONTRACT.md) dan [handover backend](BACKEND-HANDOVER.md).

## Kesimpulan berbasis bukti

Jalur web sudah memakai akun perusahaan/session/CSRF, mutasi server, UUID/version dan acknowledgment. Guard/error/permission menu tidak menggantikan authorization Laravel. Service domain, union downtime, scope, receipt atomik dan provenance impor tersedia pada source; integrasi SQL Server belum dibuktikan. Tidak ditemukan jalur produk untuk akun/sandi bersama, pemilih role palsu, gallery, generator transaksi atau penyimpanan transaksi web ke localStorage.

Tahap ini memperbaiki waktu web berdasarkan zona plant, snapshot tidak lengkap, kompatibilitas grup kosong PHP, MIME unduhan dan angka kosong. **30 test frontend lulus**, typecheck web/mobile, build web dan 3 test retry/lease mobile lulus. Pemeriksaan syntax baca-saja terhadap 78 file PHP lulus. Semua ini berbeda dari workflow perusahaan, concurrency SQL Server, native mobile dan pengesahan format asli.

Yang masih berdampak: filter tiga daftar API diabaikan (F-03), risiko snapshot/cursor bootstrap (F-04), format output belum lengkap (F-09), dan guard respons mobile (F-10). F-02 sudah diputuskan pengguna dan diterapkan di web; penyesuaian mobile masih terbuka. Login perusahaan, UAT modul terautentikasi dan go-live tetap menunggu backend/environment.

## Bukti dan batas pemeriksaan

| Jenis | Yang benar-benar diperiksa | Batas |
|---|---|---|
| Dibaca | Routes/controllers/requests/services/models/migrations, caller web/mobile, CSS, tests dan dokumen | Bukan eksekusi transaksi, policy atau SQL Server |
| Baseline | Typecheck web, 19 test frontend sebelum perubahan; 78 file PHP memakai `bin/php -l`, 0 gagal | PHP lint tidak mem-boot Laravel |
| Test terisolasi | Tiga regresi mula-mula gagal: MIME serupa PDF, metrics tidak lengkap, angka whitespace. Setelah perbaikan dan test zona/grup PHP: 30/30 lulus | Mock HTTP dan SSR fixture hanya dalam test; tidak membuat route/dataset produk |
| Build | `tsc --noEmit --incremental false`, `npm run build`, formatter | Tidak menguji database atau perangkat |
| Mobile | Typecheck dan 3 test retry/backoff/lease lulus; source tidak diubah | Tidak menguji SQLite native/SQLCipher, kamera, revoke, bootstrap interleaving |
| Output | Membuka 4 PDF/XLSX QA existing; membaca tipe cell; meninjau PNG dan merender ulang halaman PDF Yanmar ke temp | Artefak historis dengan fixture, bukan hasil ekspor baru dari backend/source saat ini atau data perusahaan |
| Historis | IMPLEMENTATION mencatat suite PHP 30 test/288 assertions dan QA login tahap sebelumnya | Tidak dijalankan ulang pada tahap ini; jangan dicampur dengan 30 test frontend |
| Belum tersedia | SQL Server/akun sah, workbook/foto asli, web/worker perusahaan, data operasional dan perangkat native | Tidak ada klaim data bersih, login sukses atau persetujuan format perusahaan |

Tidak menjalankan Artisan/backend test, migrasi/seed/provisioning, SQL, queue, scheduler, deployment atau instalasi runtime pada audit ini. Tidak membuat server/gallery baru. UAT interaksi dialog, keyboard, tablet/mobile dan mutasi gagal dengan server perusahaan belum lengkap; SSR bukan pengganti browser.

## Peta struktur dan entry point

| Path | Tanggung jawab / hubungan |
|---|---|
| `vite.config.js` → `resources/js/app.tsx` → `pages/{Login,Workspace,Error}.tsx` | Entry web aktif; Inertia resolve page, layout dan error |
| `resources/js/pages/Workspace.tsx` | Validasi props/snapshot, shell/navigation, plant, halaman dan dialog; remount provider saat plant berubah setelah mekanisme dirty navigation existing |
| `resources/js/components/` | Dashboard, Catalog, Planning, Reports, Fuel, Maintenance, Integrations, Exports; RecordForm dan UI bersama |
| `resources/js/lib/{types,contracts,http,workspace,time,usePlantTime}.*` | DTO, batas respons, session/CSRF transport, state/action server dan waktu plant; bukan mesin transaksi browser |
| `resources/css/app.css` | Token/palet, layout, form/tabel/dialog dan responsive existing. Lapisan CSS panjang bukan alasan menghapus aturan tanpa regresi visual |
| `routes/web.php`, `AuthController`, `WorkspaceController` | Login/logout, Inertia, actions, preview/export, impor dan file privat |
| `routes/api.php`, `Api/V1/OperationsController` | Token perangkat, API domain, bootstrap/push/pull; terpisah transport dari web |
| `app/Http/{Requests,Middleware}`, `bootstrap/app.php` | Validasi filter, user aktif, shared props, request ID dan error mapping |
| `app/Services/{Access,WorkspaceData}` | Scope role/plant/owner, query layar, agregat lengkap, dataset dokumen |
| `app/Services/{ReportWorkflow,Measurements,PlanningService,MaintenanceService,SyncService}` | Aturan domain, transaksi/version/decimal/interval, receipt dan cursor |
| `app/Services/{WorkbookImporter,ExportService,PdfTableWriter}`, `app/Jobs/ParseWorkbook.php` | Raw staging/version SAP, model dokumen bersama, XLSX/PDF dan pagination |
| `app/Models`, `database/migrations`, `config` | Relasi/schema/index dan konfigurasi existing; dibaca saja |
| `resources/views/app.blade.php`, `exports/` | Host Inertia dan template dokumen Laravel; dibaca saja |
| `mobile/App.tsx`, `mobile/src/{client,database,sync,evidence,retry}.*` | UI field, token SecureStore, SQLite per user/plant, outbox wire stabil, bukti dan retry |
| `tests/{Feature,Unit}`, `tests/frontend`, `mobile/tests` | PHP domain/integrasi lokal, adapter+SSR web terisolasi dan unit retry/lease; fixture bukan produk |
| `bin/php`, `.runtime`, `.env`, `storage` | Wrapper/runtime, secret dan state privat. Jangan masuk bundle/dokumen credential |
| `docs`, `output/qa` | Kontrak/handover/riwayat dan artefak QA lama; output/qa tidak dihubungkan menjadi gallery produk |

`resources/js/app.js` hanya stub `//`; tidak dirujuk entry Vite/Blade. `welcome.blade.php` tidak menjadi route aktif. Keduanya dipertahankan karena tidak ada bug terkonfirmasi yang memerlukan penghapusan. Pembersihan session `epita.demo_account` dan `localStorage.removeItem('epita.preview.v1')` tetap dipertahankan; itu cleanup akses lama. DatabaseSeeder tidak membuat dataset operasional. Test negatif/fixture tidak dihapus dari pencarian kata.

## Matriks requirement → implementasi 17 modul

Rujukan PRD adalah nomor bagian pada [01](01-PRD-EPITA.md). Seluruh field lengkap/required/enum/envelope ada pada [kontrak web](FRONTEND-CONTRACT.md): M1–M3, P1–P2, R1–R2, F1, W1–W4, S1/E1. Tabel ini tidak membuat kontrak baru. Prefix GET halaman adalah `/app/`, prefix action POST `/workspace/actions/`; preview/export memakai route tersendiri.

| # / requirement | Halaman, aksi, field utama | Route / permission | Service | Tabel / relasi | Output | Test tersedia / bukti kini | Status / pemilik gap |
|---|---|---|---|---|---|---|---|
| 1 AUTH §5/7.1/8.1 | Login email/password/remember; logout | GET/POST `/login`, POST `/logout`; user+membership aktif | AuthController, Access | users→memberships→plants→companies, sessions | Dashboard berizin | OperationalAccessTest, AccessAndSyncTest dibaca; render login kini | Source tersedia; SQL/login nyata menunggu backend/IT B01 |
| 2 DASH §8.12 | Dashboard periode/plant; KPI/trend/cutoff/drilldown | dashboard; read + capability aksi | WorkspaceData::screen/metrics | laporan/meter/fuel/kondisi/downtime/WO scoped | O-14 | WorkspaceQueryTest dibaca; SSR unknown/0 dan total kini | Agregat source tersedia; kalender/denominator/kebutuhan KPI penuh backend+bisnis |
| 3 MD-ORG §8.2 | Plant switch; lokasi create/edit/nonaktif M3 code/name/type/SAP/parent/version | locations; location.save/master; pilihan plant membership | Access, saveMaster | company→plant; location.parent_id; memberships | Referensi lokasi/plant | MasterDataTest, AccessAndSyncTest dibaca; SSR kini | Lokasi tersedia; admin company/plant/membership lengkap belum ada UI; backend B11 |
| 4 MD-EQP/PER §8.3–8.5 | Equipment/person M1/M2; code/name/category/ownership/meter/model/plate/type/active/version | equipment/people; equipment.save/person.save, master | saveMaster, Access | equipment/people plant-scoped | Master, O-06/12/13 | MasterDataTest dibaca; form render kini | Master tersedia; work/main/sub/load dictionary, reset resmi, user-person linkage backend+bisnis |
| 5 PLAN §8.6 | Rencana title/periode/items lokasi/work/target/unit P1 | planning; plan.create, plan | PlanningService::createPlan | work_plans→plan_items→activities | O-05 | MaintenanceAndPlanningTest dibaca; count server SSR kini | Create tersedia, UI satu item/create; edit/publish/calendar backend B11 |
| 6 PLAN §8.6 | Assignment equipment/operator/item/start/end/reason P2 | planning; assignment.create, plan | PlanningService::assign | assignments→equipment/people/plan_items | Daftar tugas, O-13 | Conflict test dibaca; form zona plant kini | Overlap/downtime source tersedia; helper assignment belum ada, concurrency SQL menunggu backend |
| 7 DAILY §8.7/8.8 | Editor R1 header, multi trip/sesi, meter, volume/unit/helper/lembur; simpan dan bukti | reports; report.save report-own/delegate; `/workspace/attachments` | ReportWorkflow::save, Measurements, attach | daily_reports→activities/people/attachments | O-01–04/06/08 | ReportWorkflowTest, AttachmentAccessTest dibaca; transport/SSR/zona kini | Form/source tersedia; SQL, continuity/concurrency dan upload browser UAT backend/frontend |
| 8 APPROVAL §8.10 | Detail/histori; submit confirmed, review, return reason, approve version R2 | reports/approvals; report.submit/review/return/approve; owner/approve, bukan creator/operator | ReportWorkflow::transition | reports→approval_events/audit_events; reporting_periods | Final immutable, histori | ReportWorkflowTest dibaca; ack guard kini | Server aturan tersedia; capability per-record/amendment dan SQL concurrency backend B05/B11 |
| 9 FUEL §8.9 | BBM receipt/consumption/unverified, L/KG/method; verifikasi alasan/version F1 | fuel/detail; fuel.verify, fuel-verify non-self | ReportWorkflow::verifyFuel, Measurements | fuel_events→report; stock_measurements awal | O-07, section O-01–04 | Workflow/Measurements tests dibaca; null/0 SSR kini | Verifikasi tersedia; opening/stock ledger/estimate parameter/MM belum lengkap, backend+bisnis |
| 10 MNT §8.11 | Kerusakan equipment/occurred_at/severity/description W1 | maintenance; breakdown.create, breakdown | MaintenanceService::breakdown | breakdowns→equipment/downtime_intervals | Unavailable, O-10 | MaintenanceAndPlanningTest dibaca; form SSR kini | Source tersedia; kondisi efektif/interval pada SQL nyata backend |
| 11 MNT §8.11 | WO corrective/preventive W2; action teknisi/waktu/parts W3; checks+notes release W4 | maintenance; order.create/action/release, maintain/release | MaintenanceService | orders→actions→parts; breakdown/downtime | O-11; bukan aktivitas VRA | Multi-blocker release test dibaca; form SSR kini | Source tersedia; jadwal preventive konfigurabel dan UAT rilis backend+bisnis |
| 12 DASH/angka §9 | Downtime terklip/union; volume/jam satuan sama; denominator terjadwal | exports/dashboard/equipment; export/read | Measurements::unionSeconds, ExportService | downtime_intervals, activities, orders | O-08/09/10 | MeasurementsTest dibaca; dokumen QA lama dibuka | Union benar pada source; O-09 belum lengkap, kalender backend+bisnis B11 |
| 13 IMPORT §11 | Unggah kind/system/file; progress, staging rows/raw/issues | integrations; `/workspace/import`, import; ParseWorkbook job | WorkbookImporter, ParseWorkbook | import_batches→import_rows | O-16 | WorkbookAndExportTest dibaca; multipart/guard kini | Staging tersedia; worker nyata, correction/reviewer workflow dan workbook asli backend/pemilik proses |
| 14 SAP §8.9/11 | IW47 raw/normalized/version; tab mapping/reconciliation pending | integrations; import; belum ada action final rekonsiliasi | WorkbookImporter/ParseWorkbook | sap_confirmations→import_rows; allocation/cancellation tables belum lengkap | O-15 | Provenance test dibaca; belum integration SAP | Partial; allocation/cancel/match/resolution/MM kontrak belum ada, backend+bisnis B08 |
| 15 OUTPUT §10 | Pusat laporan format/date/status/equipment/operator; preview dan PDF/XLSX | exports; `/workspace/report-preview`, `/workspace/export`, export | WorkspaceData::documentData→ExportService/PdfTableWriter | Hasil lengkap laporan/plan/fuel/WO/import scoped | O-01–16 tabel berikut | WorkbookAndExportTest dibaca; MIME/preview guard kini; 4 file lama dibuka | 12 format; field/template/pengesahan belum penuh, backend+bisnis B09 |
| 16 MOBILE §14/15 | Login device_id, bootstrap, SQLite draft/outbox/evidence, push/pull/version | `/api/v1/*`; bearer device + scope/owner | OperationsController, SyncService; mobile client/sync/db | tokens/receipts/server_changes; SQLite per user/plant | Receipt/cache/conflict | AccessAndSyncTest dibaca; mobile typecheck+3 unit kini | F-02 mobile, F-03/04/10 terbuka; backend/mobile B10/B13–15 |
| 17 AUDIT §12/17/18 | Histori/cutoff/period block/private evidence/request reference; server handover | Semua aksi & GET private attachments; authorization server | Access, workflow, RequestId, jobs | audit/approval/reporting_periods/attachments/jobs | Histori, sumber, error E1 | Scope/private/closed-period tests dibaca; 78 PHP lint kini | Backend/IT: SQL constraints/backup/restore/worker/UAT; administrasi periode/audit lengkap belum ada UI |

## Katalog keluaran dan format foto

Ada 12 nilai format pada `Exports.tsx:32–44` dan validasi ExportService. Semua memakai dataset server/model dokumen bersama, namun itu tidak membuktikan seluruh field PRD lengkap. Workbook/foto asli belum ada: perbandingan dilakukan terhadap tabel kebutuhan PRD, bukan mengklaim sudah cocok foto. Nilai unknown tetap `—`.

| ID / PRD | Jalur existing / grain | Cakupan dan gap yang harus diterima backend/pemilik proses |
|---|---|---|
| O-01 kendaraan | `vehicle`; per trip + section minggu, BBM/pelumas dan lembur | 16 kolom, meter per trip tanpa mengalikan header. Main/sub belum terpisah; BBM belum menyertakan semua referensi bukti/meter; total muatan per jenis/satuan/latex dan posisi helper1–4 perlu pengesahan sumber/format. Signer generic, tidak hardcode nama lama. |
| O-02 alat berat | `heavy`; aktivitas, HM header sekali bila tidak ada meter per sesi | 13 kolom termasuk lokasi/SAP, operator/helper dan fuel section. Estate/divisi/field/block ancestor belum dicetak lengkap. Pengesahan jabatan organisasi masih generic. |
| O-03 Yanmar | `yanmar`; per hari + seluruh sesi | Pagi/sore dan sesi tambahan, hari ini, BBM verified dan rasio hari ini tersedia. Opening/closing belum dipasok mapper; jam/solar/rasio kumulatif literal null. Lokasi/model dan total periode perlu dilengkapi sesuai sumber sah. |
| O-04 genset | `genset`; per hari + seluruh sesi/pemanasan | Gap stok/kumulatif sama O-03. Header equipment/model memakai nama; kapasitas/model bukan field output tersendiri. kWh optional tetap null tanpa sumber ukur. |
| O-05 rencana/realisasi | `plan`; plan item | Target/aktual/unit/gap/pencapaian ada; perlu verifikasi hierarchy, per-equipment/per-lokasi dan meter terkait sesuai kebutuhan asli. |
| O-06 meter | `meter`; equipment×tanggal/shift | Awal/akhir/delta/unit/status. Annotation anomali/ledger reset resmi belum lengkap. PDF besar ada bukti artefak lama. |
| O-07 BBM | `fuel`; per event/report | Jenis/makna/metode/unit/verified ditampilkan, L dan KG tidak disamakan. Rekap saldo dan parameter estimasi terversi belum lengkap. |
| O-08 volume | `volume`; work×lokasi×unit | Volume, jam yang dialokasikan dan produktivitas/jam tersedia; uji grain mencegah campur unit dan penggandaan pada SQL nyata tetap diperlukan. |
| O-09 utilisasi/produktivitas | Belum ada format khusus; O-08 parsial | Kalender jam terjadwal dan denominator utilisasi belum tersedia. Jangan memakai meter sebagai jam jadwal atau menambah tombol export palsu. |
| O-10 downtime | `downtime`; interval + ringkasan per alat | Clip periode/cutoff dan union, bukan jumlah overlap. SQL temporal/concurrency dan denominator utilisasi perlu test. |
| O-11 maintenance | `maintenance`; WO + section action/parts | Corrective/preventive, diagnosis, hasil/rilis dan part terpisah VRA tersedia. Validasi terhadap proses preventive/workshop dan file riil belum dilakukan. |
| O-12 timeline equipment | Catalog detail sebagian; tanpa format khusus | Laporan/tugas/maintenance ada di panel; belum timeline terpadu lengkap semua meter/lokasi/personel/fuel/kejadian dan ekspor mandiri. |
| O-13 personel | `personnel`; keterlibatan laporan | Operator/helper/lembur tersedia; tugas tanpa laporan dan riwayat detail seluruh penugasan perlu cakupan tambahan. |
| O-14 dashboard manajemen | Dashboard KPI/trend/drilldown; tanpa format export khusus | Source agregat periode tersedia; daftar KPI/denominator/pengesahan manajemen belum penuh dan belum UAT. |
| O-15 rekonsiliasi IW47 | Staging/mapping reference, tanpa format final | Belum allocation/cancellation/resolution/reconciliation run; upload bukan bukti match/posting MM selesai. |
| O-16 kualitas data | `quality`; batch/row/issues | Source file/sheet/baris dan masalah tersedia; workflow correction/reviewer/resolution serta raw field coverage final perlu implementasi/pengesahan. |

### File yang benar-benar dibuka

Artefak berada di `output/qa/operational-templates/` dan jelas memakai fixture pengujian. File tidak dihubungkan ke produk dan tidak diubah menjadi data perusahaan. Generator/gallery lama tidak dibuat ulang.

| Artefak historis | PDF | XLSX nonempty typed cells: angka / tanggal / string / formula | Observasi |
|---|---|---|---|
| vehicle | 1 halaman; 1.703 karakter teks | 14 / 5 / 77 / 0 | Multi-trip, subtotal minggu, BBM, lembur dan ruang pengesahan terbaca pada PNG existing |
| heavy | 1 halaman; 1.410 karakter | 7 / 4 / 64 / 0 | Tabel 13 kolom, BBM/lembur/pengesahan terbaca; hierarchy lengkap belum ada |
| yanmar | 1 halaman; 1.778 karakter | 9 / 5 / 76 / 0 | 18 kolom dan sesi tambahan diperiksa pada PNG/render ulang PDF; sel stok/kumulatif kosong tampak jelas |
| genset | 1 halaman; 1.635 karakter | 7 / 4 / 71 / 0 | Pemanasan 10 menit, nilai hari ini dan BBM; saldo/kumulatif kosong |
| meter-large | 26 halaman; 53.884 karakter | XLSX pasangan tidak tersedia di folder ini | Artefak lama kapasitas 505 baris; bukan benchmark 100k aktivitas |

Keempat XLSX memiliki sheet EPITA, print title `$5:$5`, tidak ada formula. Fixture ini tidak memiliki kode numeric berawalan nol; jadi pemeriksaan cell saat ini tidak membuktikan leading-zero edge case. Source ExportService menulis string eksplisit dan test PHP formula/leading-zero tersedia tetapi tidak dijalankan ulang. Kode berbentuk tanggal (`YYYY-MM-DD`) perlu acceptance khusus karena writer mengenali bentuk tanggal berdasarkan nilai, bukan schema kolom. Pengesahan foto asli, keluaran baru, pagination template panjang/teks ekstrem dan leading zero tetap perlu test backend. Tata letak artefak historis tidak dipakai untuk mengesahkan render source saat ini.

## Daftar temuan

Setiap lokasi menggunakan path relatif repository dan fungsi/rentang saat audit; nomor baris dapat bergeser setelah perubahan. P1 = penghambat integrasi/penerimaan terkait, P2 = berdampak, P3 = perapian. Risiko source dipisahkan dari bug yang direproduksi.

### F-01 — runtime default berbeda dari target

- **Prioritas:** P2. **Kategori:** server. **Status bukti:** dibaca/eksekusi versi CLI.
- **File dan lokasi:** `composer.json` require.php; `bin/php`; binary PATH dan Herd php84.
- **Pemicu atau ketidaksesuaian:** PATH saat audit melaporkan 8.2.33, Herd php84 8.4.25, sedangkan `bin/php -v` 8.4.27. Angka 8.5.11 dari lampiran tidak direproduksi.
- **Dampak pada pengguna/data:** command yang melewati wrapper bisa memakai runtime yang tidak memenuhi `~8.4.27`; worker/web perusahaan belum diketahui.
- **Bagian yang sudah benar dan harus dipertahankan:** wrapper proyek menegakkan minimum patch dan seri8.4; lock Laravel13.38.0; tidak memakai config.platform untuk menyamarkan runtime.
- **Tindakan yang disarankan:** backend/IT memverifikasi CLI/web/worker/scheduler tujuan dengan executable nyata; gunakan wrapper atau runtime sah yang sama.
- **Pemilik pekerjaan:** backend/IT.
- **Acceptance test:** catat versi executable tiap proses pada environment tujuan, Composer platform checks dan extension SQL; tidak sekadar php pada terminal lain.
- **Status penyelesaian atau dependency:** runtime tidak diubah. CLI wrapper lokal terverifikasi kini; header web lokal hanya bukti historis; web/worker tujuan menunggu IT.

### F-02 — zona waktu per plant

- **Prioritas:** P2. **Kategori:** frontend/mobile/kontrak. **Status bukti:** dibaca dan test terisolasi web.
- **File dan lokasi:** `resources/js/lib/time.ts:15–104`, `usePlantTime.ts`, `workspace.tsx`, `pages/Workspace.tsx:114–150`; ReportEditor dan RecordForm; `mobile/App.tsx:53,436,493–554`.
- **Pemicu atau ketidaksesuaian:** form/tampilan awal menetapkan WIB/+07 meskipun plant mempunyai timezone. Pengguna memutuskan mendukung zona masing-masing plant.
- **Dampak pada pengguna/data:** input plant WITA/WIT dapat menjadi instant yang salah dan tanggal kerja dapat bergeser bila dianggap timestamp.
- **Bagian yang sudah benar dan harus dipertahankan:** backend DTO sudah mengirim timezone; timestamp ber-offset/UTC berbeda dari work_date; payload UUID/version/enum tidak berubah.
- **Tindakan yang disarankan:** helper Intl memakai timezone plant; konversi input dua arah, pertahankan detik, tanggal kalender tetap; tolak timezone hilang/invalid tanpa fallback WIB. Editor menahan simpan dan mempertahankan input konversi invalid agar tidak mengirim instant lama. Pemilik mobile menerapkan keputusan yang sama pada UI/cache/bootstrap.
- **Pemilik pekerjaan:** frontend web selesai; mobile/backend melanjutkan.
- **Acceptance test:** satu instant UTC roundtrip WIB/WITA/WIT dengan detik, lintas tengah malam, work_date tidak bergeser, timezone invalid dan DST ambigu/gap ditolak; switch plant tidak membawa form lama ke zona baru. Lanjutkan roundtrip native→API→web→export pada SQL uji.
- **Status penyelesaian atau dependency:** web diterapkan, test zona dan render lulus; mobile masih +07 dan tidak diedit; UAT lintas client menunggu backend/mobile.

### F-03 — filter API diterima tetapi diabaikan

- **Prioritas:** P2. **Kategori:** backend/kontrak. **Status bukti:** dibaca, bug perilaku query pada source; belum integrasi nyata.
- **File dan lokasi:** `app/Http/Controllers/Api/V1/OperationsController.php:61–79`, `WorkspaceFilterRequest`, WorkspaceData::reports.
- **Pemicu atau ketidaksesuaian:** parameter periode/status/q/equipment/operator divalidasi, tetapi assignments/breakdowns/maintenance-orders hanya memakai plant dan aturan owner. Hanya daily-reports memakai query filter bersama.
- **Dampak pada pengguna/data:** konsumen API yang mengirim filter dapat menerima hasil di luar filter; tidak menyatakan UI mobile saat ini sudah memakai setiap filter itu.
- **Bagian yang sudah benar dan harus dipertahankan:** scope plant/owner, pagination dan filtered daily-reports tersedia; filter web memakai jalur WorkspaceData berbeda.
- **Tindakan yang disarankan:** sepakati filter per resource lalu terapkan query/penolakan parameter unsupported; [API](API.md) kini menyatakan keterbatasan existing secara eksplisit.
- **Pemilik pekerjaan:** backend, B13.
- **Acceptance test:** minimal dua periode/status/plant/owner, kombinasi q/equipment/operator dan interval lintas periode; assert IDs serta total, bukan hanya200. Unsupported tidak boleh silently ignored.
- **Status penyelesaian atau dependency:** kontrak/dokumentasi diperbaiki; endpoint tidak diubah.

### F-04 — snapshot dan cursor bootstrap tidak konsisten secara atomik

- **Prioritas:** P1. **Kategori:** backend/database/mobile. **Status bukti:** dibaca; risiko concurrency, bukan insiden kehilangan data yang direproduksi.
- **File dan lokasi:** `OperationsController.php:54–58`, WorkspaceData::snapshot, `SyncService::pull`, mobile bootstrap/sync.
- **Pemicu atau ketidaksesuaian:** snapshot dibaca sebelum MAX(server_changes.id); transaksi lain dapat commit di antaranya.
- **Dampak pada pengguna/data:** event berpotensi tidak masuk snapshot tetapi terlewati cursor awal sehingga tidak dikirim pull berikutnya.
- **Bagian yang sudah benar dan harus dipertahankan:** pull paginated dengan until/high-water; receipt+mutasi atomik dan replay canonical hash; wire operation ID stabil.
- **Tindakan yang disarankan:** backend membuktikan snapshot/high-water konsisten sesuai strategi SQL Server dan versi payload, bukan sekadar memindahkan pembacaan angka cursor.
- **Pemilik pekerjaan:** backend/database dengan mobile, B14.
- **Acceptance test:** dua koneksi dan barrier: pause bootstrap setelah pembacaan snapshot, commit perubahan dari koneksi lain, lanjut cursor/pull; setiap perubahan diterima snapshot atau pull tanpa hilang, termasuk pagination/filter scope/restart.
- **Status penyelesaian atau dependency:** source tidak diubah; test SQL Server interleaving wajib sebelum penerimaan sync.

### F-05 — precedence dokumen lama belum jelas

- **Prioritas:** P3. **Kategori:** dokumentasi. **Status bukti:** dibaca.
- **File dan lokasi:** `docs/02-MASTER-PROMPT.md`, README dan dokumen yang dirujuk lampiran.
- **Pemicu atau ketidaksesuaian:** arahan awal mencakup pembangunan backend/runtime; numbered03/04/05 tidak semua tersedia dengan nama tersebut.
- **Dampak pada pengguna/data:** scope lama dapat dieksekusi ulang atau klaim status lama dibaca sebagai penerimaan terbaru.
- **Bagian yang sudah benar dan harus dipertahankan:** PRD/master asli sebagai sumber kebutuhan/riwayat; kontrak/handover existing.
- **Tindakan yang disarankan:** indeks authoritative dengan pemetaan nama, canonical caller web/API, status historis dan scope terbaru.
- **Pemilik pekerjaan:** frontend/dokumentasi.
- **Acceptance test:** README→indeks→audit/kontrak/handover terhubung; file eksternal hilang disebut eksplisit; tidak ada klaim isi file belum dibaca.
- **Status penyelesaian atau dependency:** selesai pada dokumentasi lokal; arsip asli tidak diubah.

### F-06 — snapshot guard terlalu dangkal dan grup kosong PHP berbeda bentuk

- **Prioritas:** P2. **Kategori:** frontend/kontrak. **Status bukti:** dibaca dan test terisolasi sebelum/sesudah.
- **File dan lokasi:** `resources/js/lib/contracts.ts:4–104`, `workspace.tsx:95`, `pages/Workspace.tsx:114`.
- **Pemicu atau ketidaksesuaian:** metrics parsial `{}` dapat lolos guard lama. Sebaliknya group SQL kosong melalui pluck()->all() dapat menjadi `[]`, berbeda dari kamus `{}` yang dipakai fixture awal.
- **Dampak pada pengguna/data:** statistik tidak lengkap dapat tampak valid, atau hasil kosong sah menjadi error saat guard diperketat tanpa adapter.
- **Bagian yang sudah benar dan harus dipertahankan:** missing snapshot tetap error; null pengukuran berbeda0; tidak membuat snapshot transaksi kosong saat layanan gagal.
- **Tindakan yang disarankan:** validasi metrics/counts/cutoff/list/nested array yang dipakai UI; hanya normalkan dua bucket kosong PHP yang diketahui menjadi kamus kosong.
- **Pemilik pekerjaan:** frontend.
- **Acceptance test:** incomplete metrics dan nested malformed ditolak; PHP empty groups diterima pada initial render dan mutation normalization; missing scalar tidak diisi0; unknown measurement tetapnull.
- **Status penyelesaian atau dependency:** selesai; regresi guard/normalization/SSR lulus. Guard bukan validasi domain atau pengganti server.

### F-07 — MIME mirip PDF lolos

- **Prioritas:** P2. **Kategori:** frontend. **Status bukti:** test terisolasi gagal lalu lulus.
- **File dan lokasi:** `resources/js/lib/http.ts`, requestBinary pemeriksaan content-type.
- **Pemicu atau ketidaksesuaian:** substring match menerima `application/pdf-fake` dengan signature PDF.
- **Dampak pada pengguna/data:** UI dapat mengakui jenis berkas yang bukan MIME kontrak.
- **Bagian yang sudah benar dan harus dipertahankan:** signature PDF/ZIP, redirect/login/error tidak sukses, tanpa auto retry transaksi.
- **Tindakan yang disarankan:** bandingkan media type tepat setelah normalisasi case/parameter.
- **Pemilik pekerjaan:** frontend.
- **Acceptance test:** MIME resmi+parameter diterima; lookalike, HTML, signature salah ditolak untuk PDF/XLSX.
- **Status penyelesaian atau dependency:** selesai, test unduhan lulus.

### F-08 — whitespace ditampilkan sebagai nol

- **Prioritas:** P2. **Kategori:** frontend. **Status bukti:** test terisolasi gagal lalu lulus.
- **File dan lokasi:** `resources/js/lib/types.ts:281`, number formatter.
- **Pemicu atau ketidaksesuaian:** Number('   ') menjadi0.
- **Dampak pada pengguna/data:** data belum tersedia terlihat sebagai pengukuran nol.
- **Bagian yang sudah benar dan harus dipertahankan:** nol terkonfirmasi tetap0; string decimal sah tetap diformat; unit tidak dicampur.
- **Tindakan yang disarankan:** string kosong sesudah trim menjadi unavailable; pertahankan null/NaN handling.
- **Pemilik pekerjaan:** frontend.
- **Acceptance test:** undefined/null/empty/whitespace/NaN→`—`; numeric0/string0→0; decimal sah tetap benar.
- **Status penyelesaian atau dependency:** selesai, test lulus.

### F-09 — kebutuhan keluaran belum lengkap

- **Prioritas:** P2. **Kategori:** backend/kontrak. **Status bukti:** dibaca dan inspeksi artefak historis; gap kebutuhan, bukan bug angka baru direproduksi.
- **File dan lokasi:** `resources/js/components/Exports.tsx:32–44`, `app/Services/ExportService.php:60–210` khusus mesin:84–94; WorkspaceData mapper report:160–180; PRD§10.
- **Pemicu atau ketidaksesuaian:** 12 format versus16 kebutuhan; kolom stok mapper tidak dipasok, kumulatif literalnull dan schema kalender/reconciliation belum lengkap. Writer XLSX mengenali tanggal berdasarkan bentuk string, sehingga kode date-like memerlukan perlindungan schema.
- **Dampak pada pengguna/data:** sebagian rekap/hierarchy/saldo/kumulatif/pengesahan belum dapat diterbitkan lengkap; kode berbentuk tanggal berpotensi berubah tipe saat export.
- **Bagian yang sudah benar dan harus dipertahankan:** output kosong/unknown jujur, filter/scope/model bersama, tidak mengalikan header tiap trip, string formula eksplisit, union downtime, tidak menebak saldo atau jabatan.
- **Tindakan yang disarankan:** backend+bisnis menutup matriks O-01–16, menetapkan sumber opening/cumulative/denominator dan signer; typed columns membedakan date dari code. Jangan menambah format frontend yang belum didukung endpoint.
- **Pemilik pekerjaan:** backend+database+bisnis, B08/B09/B11.
- **Acceptance test:** foto/workbook sah dipetakan field demi field; multiperiod/multisession/overlap/mixed units/null/0/helper1–4; total unik, kumulatif numerator/denominator sama; kode `00123` dan `2026-10-01` tetaptext pada kolomcode; formula injection tidak dieksekusi; preview/PDF/XLSX sama filter/sumber; buka file hasil baru dan sahkan visual.
- **Status penyelesaian atau dependency:** matriks/gap dan acceptance selesai didokumentasikan; implementasi backend dan pengesahan output menunggu sumber/owner.

### F-10 — respons mobile 200 rusak dikembalikan sebagai payload typed

- **Prioritas:** P2. **Kategori:** mobile/kontrak. **Status bukti:** dibaca; jalur kontrol terkonfirmasi source, belum dieksekusi native.
- **File dan lokasi:** `mobile/src/client.ts:20–42`, pemanggil login/bootstrap/me/pull.
- **Pemicu atau ketidaksesuaian:** parse JSON gagal menjadi object message; jika HTTP200, object itu dikembalikan sebagai T tanpa guard envelope.
- **Dampak pada pengguna/data:** login/bootstrap/validasi sesi dapat menerima payload yang tidak memenuhi kontrak lalu gagal di downstream atau menyimpan field tidak sah.
- **Bagian yang sudah benar dan harus dipertahankan:** ApiError non2xx, token/device secure storage, UUID/wire retry stabil, receipt identity dan lease.
- **Tindakan yang disarankan:** tolak redirect/nonJSON/invalid200; guard identity/envelope/fields setiap respons mobile sebelum menyimpan sesi/cache/cursor.
- **Pemilik pekerjaan:** mobile/backend, B15.
- **Acceptance test:** HTML login, null/array, JSON rusak, token/plant/receipt/cursor hilang dan mismatch tidak menandai authenticated/applied atau memajukan cursor; input/outbox dipertahankan dengan opID/wire sama.
- **Status penyelesaian atau dependency:** source mobile tidak diubah; perlu test adapter/native dan implementasi pemilik mobile.

## Aturan yang sudah benar dan perlu dilindungi

Pada pembacaan service: Measurements memisahkan meter/durasi/volume, BCMath/DECIMAL, rasio null/denominator0, dan union interval clipped. ReportWorkflow memeriksa continuity sebelumnya/berikutnya, period lock, overlap, verified fuel, self-approval termasuk multi-role, actor/provenance dari server dan final immutable. Planning mengunci equipment/operator dan memeriksa downtime; Maintenance release mempertahankan blocker lain. KPI/document memakai hasil lengkap terotorisasi, bukan subset page. Pengujian SQL Server belum mengonfirmasi locking/constraint ini.

SyncService menyimpan receipt bersama perubahan dalam transaksi, canonical hash menolak changed payload replay. Mobile menyimpan wire_json dan opID stabil; **database.ts:75 sudah mengembalikan status sending→queued saat membuka DB**. Jadi recovery crash bukan gap source yang dinyatakan hilang; tetap perlu test native crash/replay. Bukti diunggah sebelum submit dan cache dipisahkan per user/plant. ParseWorkbook memeriksa ulang akses sebelum dan dalam transaksi, raw payload/sheet/row dipertahankan, versi confirmation SAP tidak ditimpa sebagai histori tunggal. Semua ini harus dipertahankan ketika menutup F-03/04/10.

## Keputusan, urutan handover dan acceptance

| Keputusan/dependency | Keadaan kini | Pemilik / kriteria penutupan |
|---|---|---|
| Zona waktu | Disetujui per plant; web selesai, mobile belum | Mobile/backend: roundtrip lintas client sesuai plant.timezone, work_date tetap |
| Database dan akun | Ditunda pengguna; tidak ada fallback/akun bersama | Backend/IT: SQL uji terpisah, akun/membership sah, login/session/scope nyata |
| Calendar/shift/denominator | Belum disahkan | Bisnis+backend: interval kerja/istirahat/holiday dan definisi utilisasi tersimpan/berversi |
| BBM opening/stock/estimate/MM | Workflow/parameter akhir belum disahkan | Bisnis+backend: bukti ukur, reviewer dan kebijakan versi; receipt bukan konsumsi |
| Approval/evidence/amendment/reset | Aturan minimum ada; tier/kewajiban/reset resmi belum lengkap | Bisnis+backend: matriks per-role/record, final correction trace, meter continuity |
| Main/sub, helper assignment, signer/template | Struktur akhir/sumber asli belum ada | Pemilik proses+backend: kamus dan foto asli, signer dari organisasi, UAT O-01–04 |
| SAP | Mapping/allocation/cancellation/resolution belum final | Bisnis+backend: workbook asli, identity/unit/work/posting rules dan unresolved disposition |
| Retensi/offline/SLA/kapasitas | Lease default dan target PRD bersifat usulan | IT/bisnis: kebijakan sah, SQLCipher/perangkat/revoke, beban/backup+restore |

Urutan backend: B01 environment/akun dan B02/B03 kontrak; B13 filter API, B14 bootstrap atomik dan B15 guard mobile; B05 concurrency/workflow; B06/B07 bukti/job; B08/B09/B11 gap kebutuhan; B12 kapasitas dan UAT perusahaan. Lihat acceptance terinci [handover](BACKEND-HANDOVER.md). Tidak ada pesan/dokumen dikirim ke pengembang lain secara otomatis.

## Integritas scope dan pemulihan

Baseline hash pra-perubahan: `/private/tmp/epita-final-audit-baseline.json`. Checkpoint frontend/docs: `/var/folders/ts/d_thqp0560v2tbp7xrchbw440000gn/T/epita-finalization-20261023-kv0j7ufa/frontend-docs-before.tar.gz`. Checkpoint bukan backup database dan tidak memuat secret .env. Workspace tidak memiliki repository Git; tidak dibuat git init atau reset.

Perbandingan akhir terhadap **106 file baseline di luar scope: 0 berubah/hilang dan 0 file baru** pada app/bootstrap/config/routes/database/bin/mobile/resources/views, .env, composer/package/lockfile dan konfigurasi build. Frontend/tests/docs dan hasil public/build memang berubah sesuai implementasi. PRD/master asli juga dipertahankan. Pemeriksaan tautan lokal README/docs menemukan53 tautan, 0 tujuan hilang. Tidak menghapus data atau merombak schema agar audit terlihat lulus. Status akhir tahap ini adalah **frontend dan dokumen diperbaiki serta terverifikasi secara terisolasi; integrasi dan go-live belum diterima**.

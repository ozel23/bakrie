# Kontrak frontend EPITA untuk integrasi backend

Tanggal audit: 23 Oktober 2026. Sumber: React/TypeScript, `routes/web.php`, `WorkspaceController`, `WorkspaceFilterRequest`, application services dan konfigurasi existing. Backend dibaca saja. Dokumen ini tidak membuktikan endpoint sudah berjalan pada server perusahaan.

Urutan acuan dan status dokumen: [indeks](00-INDEX.md). Audit final seluruh modul, temuan dan dependency: [FINAL-AUDIT](FINAL-AUDIT.md). Kontrak ini canonical untuk caller web existing; keterbatasan filter/bootstrap API mobile dicatat di [API](API.md).

Status bukti yang dipakai: **Ditemukan** = ada pada source; **Dibaca** = perilaku ditelusuri tanpa menjalankan backend; **Diuji frontend** = adapter/render dengan respons terisolasi; **Usulan** = memerlukan persetujuan kedua pengembang. Hasil SQL Server dan UAT tetap tanggung jawab pengembang backend yang ditunjuk.

## Transport dan autentikasi web

Website tetap React + TypeScript + Inertia di Laravel. GET halaman mengembalikan page Inertia, login/logout memakai session; mutasi JSON/multipart memakai cookie session yang sama dan CSRF. Jangan mengganti autentikasi web dengan bearer token mobile atau memisahkan SPA tanpa kesepakatan deployment.

| Pemicu | Method / route ditemukan | Request / hasil yang dibaca |
|---|---|---|
| Membuka login | GET `/login` | Page `Login`, `status?`, shared validation errors; tanpa akun pengganti |
| Masuk | POST `/login` | `email:string!`, `password:string!`, `remember:boolean`; redirect `/dashboard` lalu `/app/dashboard`; validasi field pada session |
| Keluar | POST `/logout` | Invalidate session, redirect `/login` |
| Halaman modul | GET `/app/{page}` | Props di bawah; `page` hanya dashboard/equipment/people/locations/planning/reports/approvals/fuel/maintenance/exports/integrations |
| Simpan / transisi | POST `/workspace/actions/{action}` | JSON sesuai kamus action; respons snapshot layar + `mutation` |
| Lihat dokumen | POST `/workspace/report-preview` | Filter dokumen; JSON model dokumen, bukan file |
| Ekspor | POST `/workspace/export` | Filter + `output:pdf|xlsx`; binary berjenis MIME sesuai output |
| Impor | POST `/workspace/import` | Multipart; JSON ImportBatch dengan UUID/status, HTTP 202 untuk job baru |
| Bukti | POST `/workspace/attachments` | Multipart; JSON `{uuid,checksum}`, HTTP 201 baru atau 200 replay |
| Buka bukti | GET `/attachments/{uuid}` | File privat, periksa hak pada laporan, tidak membuka direktori publik |

Adapter: `resources/js/lib/http.ts`. Tidak menyimpan token/secret atau transaksi ke localStorage. JSON harus object yang dapat dibaca. HTML/login redirect yang diterima fetch bukan acknowledgment. Tidak ada retry otomatis mutasi karena timeout dapat terjadi sesudah transaksi tersimpan.

## Page props dan sumber data

Rujukan DTO: `resources/js/lib/types.ts`; guard respons: `resources/js/lib/contracts.ts`.

| Prop | Tipe / aturan |
|---|---|
| `page` | Nama halaman dari daftar route |
| `auth` | `{name:string,email:string,role_label?:string,person_uuid?:UUID|null}` dari session server; wajib untuk Workspace |
| `plant`, `plants` | Plant aktif dan pilihan plant berizin: `uuid,name,code,timezone`; timezone adalah identifier IANA valid, misalnya Asia/Jakarta, Asia/Makassar, Asia/Jayapura. Plant aktif wajib mempunyai timezone yang diterima Intl; data hilang/invalid menjadi error aman, tanpa fallback WIB. Field sudah ada pada DTO backend. |
| `permissions` | `string[]` dari union membership aktif; array kosong tidak memberi aksi tulis |
| `snapshot` | Object data sah; kegagalan layanan tidak boleh diganti snapshot kosong |
| `filters` | Object nilai filter yang telah divalidasi server; periode berasal dari server |
| `error?` | Pesan operasional; bukan pengganti page error 403/503 dan bukan tempat SQL/stack trace |

`snapshot` berisi `equipment[]`, `people[]`, `locations[]` sebagai referensi scoped; `reports[]`, `plans[]`, `assignments[]`, `breakdowns[]`, `orders[]`, `imports[]`; `metrics`; `pagination`; `catalog_rows`; `fuel_page_uuids`. Array kosong hanya hasil kosong sah. Pada layar, daftar resource berhalaman bukan seluruh populasi. `catalog_rows.{equipment,people,locations}` adalah baris tabel; referensi master bukan pengganti total hasil pencarian.

`pagination[resource] = {total,current_page,last_page,per_page,from,to}`. Semua integer kecuali `from/to` boleh null saat kosong. Resource: reports/equipment/people/locations/assignments/plans/orders/breakdowns/imports/fuel. Nilai per_page 8/15/30. Bila metadata server hilang, UI menjelaskan total belum tersedia dan tidak membuat total dari subset halaman.

GET filter: `plant:UUID?`, `period:YYYY-MM?`, `q:string<=150?`, `status?`, `equipment_uuid?`, `operator_uuid?`, `category:all|heavy_equipment|vehicle|engine|genset?`, `condition:all|working|standby|breakdown|maintenance|unknown?`, `meaning:unverified|receipt|consumption?`, `{resource}_page:integer>=1?`, `{resource}_per_page:8|15|30?`. Status route menerima all/pending/draft/submitted/reviewed/returned/approved/open/in_progress/released/closed/assigned/completed/cancelled. Kombinasi filter harus diterapkan server, termasuk scope operator.

`metrics`: report_counts, reports, meter (HM/KM/H terpisah), receipt_liters, consumption_liters, fuel_pending, equipment_conditions, active_equipment, trend[{date,unit,total}], open_breakdowns, active_orders, released_orders, orders, breakdowns, assignments, assigned_equipment, plans, cutoff, start_date/end_date. Sumber adalah agregat seluruh hasil berizin dalam periode, bukan array layar. `report_counts`/`equipment_conditions` adalah bucket hasil group: bucket yang tidak muncul dapat dibaca nol hanya ketika agregasi induknya berhasil. Nilai pengukuran/sum yang belum diketahui tetap null/`—`, bukan nol. `cutoff` adalah waktu snapshot server, bukan bukti koneksi terus aktif.

Adapter menormalkan **hanya** `metrics.report_counts:[]` dan `equipment_conditions:[]` menjadi `{}` karena grup kosong PHP dapat diserialisasi sebagai array. Metrics/scalar yang hilang tidak dibuat0. Guard menolak count bukan integer nonnegatif, measurement tidak terbaca, cutoff invalid dan array nested yang dibutuhkan layar hilang. Ini validasi bentuk respons, bukan validasi domain lengkap.

## Aturan tipe bersama

`!` berarti wajib; `?` berarti opsional; `null` hanya jika disebut nullable. UUID publik berbeda dari PK BIGINT internal. Kode, nomor polisi, SAP order/operation dan leading zero tetap string. Kuantitas/meter dikirim string desimal dengan titik, bukan string tampilan berformat ribuan. Server memakai DECIMAL(18,3)/BCMath. Durasi/break_seconds adalah detik integer; lembur menit integer. Tanggal kerja `YYYY-MM-DD`, berbeda dari posting_date dan timestamp UTC. Timestamp request ISO 8601 dengan offset; web mengirim ISO UTC hasil konversi input zona plant. Tidak menyamakan HM/KM/H, durasi aktivitas, quantity atau satuan volume.

### Waktu per plant — keputusan F-02

Pengguna menetapkan dukungan zona masing-masing plant. `lib/time.ts` dan `usePlantTime.ts` menggunakan `plant.timezone` untuk tampilan timestamp, tanggal hari ini, cutoff dan input `datetime-local` dua arah. WIB/WITA/WIT adalah label sesuai identifier, bukan offset tetap global. Input mempertahankan detik (`step=1`), sesi lintas tengah malam memakai tanggal akhir sebenarnya. `work_date`, periode dan tanggal rencana tetap tanggal kalender, tidak dikonversi menjadi instant. Waktu invalid, gap DST dan waktu ambigu ditolak; jangan menebak offset.

Editor mempertahankan input waktu yang konversinya gagal dan menahan simpan sampai field diperbaiki/dihapus; tidak diam-diam mengirim instant lama. Verifikasi perilaku interaksi browser lengkap tetap menunggu UAT terautentikasi.

Pergantian plant mereset provider/form dengan identitas plant setelah mekanisme konfirmasi unsaved existing. Tidak membawa draft form plant lama ke zona baru. Web tidak menambah endpoint atau mengubah penyimpanan server. Backend/export sudah menerima timezone plant pada source; konsistensi hasil nyata belum diuji. Mobile masih memakai WIB/+07 dan perlu penyesuaian pemilik mobile serta acceptance lintas client. Test web roundtrip WIB/WITA/WIT, detik, lintas hari, invalid/DST dan tanggal kalender sudah lulus terisolasi.

Semua action JSON mendapat `plant_uuid:UUID!` dan `context_page:string!` dari provider; query membawa filter layar. Identitas aktor, scope akhir, totals, kondisi equipment final, status persetujuan dan keputusan akses wajib ditentukan server.

## Matriks mutasi

Semua baris berikut berstatus **Ditemukan/Dibaca**. Adapter acknowledgment/error-nya diuji terisolasi. Endpointnya belum diuji pada perusahaan. Setiap payload di bawah ditambah envelope bersama di atas; respons sukses memakai S1, error memakai E1.

| Halaman / tombol | `{action}` | Service / handler existing | Payload kamus | Permission server |
|---|---|---|---|---|
| Equipment → Tambah/Edit/aktif | equipment.save | WorkspaceController::saveMaster | M1 | master |
| Personel → Tambah/Edit/aktif | person.save | saveMaster | M2 | master |
| Lokasi → Tambah/Edit/aktif | location.save | saveMaster | M3 | master |
| Rencana → Rencana baru | plan.create | PlanningService::createPlan | P1 | plan |
| Rencana → Buat penugasan | assignment.create | PlanningService::assign | P2 | plan |
| Laporan → Simpan draft/revisi | report.save | ReportWorkflow::save | R1 | report-delegate atau report-own sesuai penugasan/owner |
| Detail draft/revisi → Kirim | report.submit | ReportWorkflow::transition | R2 + confirmed=true | Hak edit; konfirmasi wajib |
| Detail antrean → Periksa | report.review | transition | R2 | approve; bukan pembuat/operator |
| Detail antrean → Kembalikan | report.return | transition | R2 + reason wajib | approve; bukan pembuat/operator |
| Detail antrean → Setujui | report.approve | transition | R2 | approve; bukan pembuat/operator |
| BBM/detail → Simpan verifikasi | fuel.verify | ReportWorkflow::verifyFuel | F1 | fuel-verify; pemeriksa lain |
| Perawatan/dashboard → Kerusakan | breakdown.create | MaintenanceService::breakdown | W1 | breakdown; scope equipment |
| Perawatan → Buat work order | order.create | MaintenanceService::order | W2 | maintain |
| Detail WO → Tindakan | order.action | MaintenanceService::action | W3 | maintain |
| Detail WO → Pemeriksaan/rilis | order.release | MaintenanceService::release | W4 | release |

**S1 acknowledgment:** HTTP 200 JSON `{...WorkspaceData, mutation:{uuid:string,version:integer>=1}}`. Snapshot harus untuk context_page/filter yang dikirim, termasuk ketika record keluar dari filter setelah transisi. Frontend menerima identitas yang sama dengan uuid/report_uuid yang dikirim, versi baru lebih besar dari versi input, lalu memperbarui snapshot/versi form. HTTP 200 berformat rusak atau tanpa mutation tidak memicu success. Mutasi mungkin telah tersimpan meskipun respons terputus: periksa data terbaru sebelum mengulang. Create master/plan/assignment/WO belum mempunyai operation_id web umum; jangan menambahkan retry otomatis.

**E1:** 401 sesi habis; 403 scope/permission; 404 identitas/endpoint tak tersedia; 409 stale version/identity/conflict; 419 CSRF/session; 422 field; 429 throttle; 5xx layanan. JSON `{message:string,errors?:Record<string,string|string[]>,request_id?:string}`, header `X-Request-ID`. Nested errors memakai dot notation, misalnya `activities.0.ends_at`, `items.0.target`, `parts.0.quantity`. Body error tidak boleh membocorkan SQL, bindings, host, file privat atau secret. Inertia validation login berbeda: errors dibagikan ke useForm melalui redirect/session.

UI seluruh mutasi: awal editable → pending (cegah aksi ganda) → setelah ack success dan close/update, atau error dengan input tetap. 401/419 menyediakan aksi Masuk kembali; perpindahan dari form dirty mengikuti konfirmasi kehilangan input. 409 tidak menimpa input dengan versi baru diam-diam. Retry otomatis hanya polling/read; tidak menganggap HTTP redirect/login sebagai submit berhasil.

## Kamus request form

### M1–M3 master

| Field | Tipe / required / validasi source |
|---|---|
| `uuid` | Opsional saat create; UUID existing saat edit. UI create mengirim string kosong yang dinormalisasi nullable oleh Laravel. |
| `version` | Integer! >=0. Create 0; update versi server terbaru. |
| `code` | String! <=64, unik per plant |
| `name` | String! <=255 |
| `active` | Boolean, UI mengirim eksplisit; nonaktif mempertahankan histori |
| M1 `category` | heavy_equipment/vehicle/engine/genset! |
| M1 `model`, `plate` | Nullable string, maksimal 255 / 32 |
| M1 `ownership` | OWN/LEND/RENT/unverified!; unverified adalah fakta bisnis |
| M1 `meter_unit` | HM/KM/H!; kode/unit dengan histori butuh proses koreksi yang sah |
| M2 `type` | operator/driver/helper/technician! |
| M3 `type` | estate/division/field/block/workshop/factory/office/route! |
| M3 `sap_code`, `parent_uuid` | Nullable string<=64 / UUID; induk dalam plant, tidak membentuk siklus |

Frontend tidak membuat akun pengguna dari Person. Hubungan people.user_id, keanggotaan, company/plant aktif dan pemberian role dikelola backend, bukan disimulasikan oleh UI.

### P1 rencana dan P2 penugasan

| Field | Tipe / aturan source |
|---|---|
| P1 `title`, `starts_on`, `ends_on` | String<=255!; date!; date! >=starts_on |
| P1 `notes` | Nullable string<=2000 |
| P1 `items[]` | Array! 1–50; UI form existing membuat satu item per create |
| `items.*.location_uuid`, `work_code`, `description` | UUID lokasi aktif dalam plant!; string<=64!; string<=255! |
| `items.*.target`, `unit` | Desimal >0!; enum M/M2/M3/KG/TON/PKK/L/ORANG/PALLET! |
| P2 `equipment_uuid`, `operator_uuid` | UUID! alat aktif dan operator/driver aktif dalam plant |
| P2 `plan_item_uuid` | Nullable UUID milik rencana pada plant; interval assignment harus di periode rencana |
| P2 `starts_at`, `ends_at` | Timestamp!; ends_at >starts_at; server menolak overlap alat/operator dan downtime |
| P2 `reason` | Nullable string<=2000; wajib bila ad hoc/tanpa plan_item_uuid |

Penugasan helper belum mempunyai field/relasi pada create assignment existing; jangan mengirim helper baru seolah didukung. Detail helper pada laporan tetap tersedia. Editing/publish plan dan kalender konfigurabel belum mempunyai kontrak lengkap.

### R1 laporan harian

| Field | Tipe / aturan source |
|---|---|
| `uuid` | UUID create stabil dari client; UUID existing saat update |
| `version` | Integer! >=0, create=0, update=latest |
| `equipment_uuid`, `operator_uuid` | UUID! satu plant; operator/driver aktif. Alat tidak boleh diganti sesudah create. |
| `work_date`, `shift` | date!; string<=24!, UI pilihan utama/pagi/sore/malam |
| `condition` | working/standby/breakdown/maintenance!; unknown pada kondisi master tetap sah, bukan otomatis standby |
| `meter_start`, `meter_end` | Nullable desimal>=0; UI kosong dikirim null. Validasi wajib saat submit sesuai kondisi/kategori oleh server. |
| `notes`, `exception_reason` | Nullable string<=5000 / <=2000 |
| `overtime_minutes` | Integer 0–1440 |
| `activities[]`, `fuel_events[]` | Array wajib hadir, boleh kosong saat draft; batas 50 / 30 |
| `helpers[]` | Opsional array<=4: `{person_uuid:UUID!,overtime_minutes:int! 0–1440}`; aktif/satu plant/tidak ganda |

Activity: `starts_at:timestamp!`, `ends_at:timestamp!`, `break_seconds:int>=0!`, `description:string<=2000!`; nullable `location_uuid`, `plan_item_uuid`; nullable `quantity:decimal>=0`, `unit:string<=16`, `work_code:string<=64`; nullable `origin,destination,cargo:string<=255`; nullable `meter_start,meter_end:decimal>=0`; nullable `sap_order,sap_operation:string<=64`. Aktivitas berurutan, tidak overlap; break tidak melebihi durasi; quantity membutuhkan unit; realisasi item rencana memakai satuan yang sama. Kendaraan mendukung beberapa trip, mesin/genset beberapa sesi; UI tidak mengesahkan hasil preview meter/waktu sebagai total final.

Fuel: `meaning:unverified|receipt|consumption!`, `quantity:decimal>=0!`, `unit:L|KG!`, `fuel_type:string<=32!`, `method:direct|stock_balance|estimate!`, nullable `place:string<=255`. Pengisian bukan konsumsi. Angka KG tidak dijumlah sebagai liter. Server mengesahkan makna/metode dan sumber pengukuran; form bukan tempat mengarang saldo stok atau parameter estimasi.

R2 transisi: `uuid:UUID!`, `version:int>=1!`, `reason:nullable string<=2000` (wajib untuk return), `confirmed:boolean` (harus true untuk submit). Alur dibaca: draft/returned → submitted → reviewed/returned/approved. Save revisi kembali draft. Approved immutable; amendment/reset meter belum menjadi kontrak frontend baru. Approval akhir membutuhkan BBM seluruhnya terverifikasi, kontinuitas meter, periode terbuka dan aturan submission server.

### F1 verifikasi BBM

`report_uuid:UUID!`, `version:int!`, `fuel_uuid:UUID!`, `meaning:receipt|consumption!`, `method:direct|stock_balance|estimate!`, `reason:string<=2000!`. Hanya saat submitted/reviewed, pemeriksa bukan pembuat/operator. Hasilnya versi laporan bertambah; UI menutup detail lama sesudah ack agar versi/status stale tidak dipakai.

### W1–W4 maintenance

| Kamus | Field / aturan source |
|---|---|
| W1 breakdown | `equipment_uuid:UUID!`, `occurred_at:timestamp!`, `description:string<=5000!`, `severity:low|medium|high|critical!` |
| W2 order | `equipment_uuid:UUID!`, nullable `breakdown_uuid` milik alat dan open, `type:corrective|preventive!`, `diagnosis:string<=5000!`, `starts_at:timestamp!`; preventive tanpa breakdown |
| W3 action | `uuid:UUID-WO!`, `version:int!`, `technician_uuid:UUID-teknisi-aktif!`, `starts_at,ends_at:timestamp!` akhir>mulai, `description,result:string<=5000!`, `parts:array! <=50` |
| `parts.*` | `code:string<=64!`, `name:string<=255!`, `quantity:decimal>0!`, `unit:string<=16!`, nullable `warehouse_reference:string<=255` |
| W4 release | `uuid:UUID-WO!`, `version:int!`, `functional_test:true!`, `safety_check:true!`, `notes:string<=2000!`; WO punya tindakan, belum released |

Tindakan/part maintenance tidak masuk aktivitas VRA. Rilis satu WO tidak menghapus blokir downtime lainnya. UI tidak mengubah kondisi alat sendiri; membaca snapshot hasil keputusan server.

## Bukti, impor dan dokumen

Attachment multipart: `report_uuid:UUID!`, `attachment_uuid:UUID?` (frontend menyediakan UUID stabil per File), optional `checksum:SHA256 lowercase hex`, `file:jpg|jpeg|png|pdf! <=5120 KB`. Backend memeriksa hak edit, checksum, MIME, identitas dan file privat. Replay UUID sama/isi sama mengembalikan acknowledgment; isi berbeda 409. Frontend hanya menganggap upload selesai bila UUID cocok dan checksum ada. Bila draft tersimpan tetapi upload berikutnya gagal, versi hasil save dan file yang belum selesai tetap ada; file yang sudah diakui tidak diunggah ulang secara lokal. Jangan mengklaim seluruh rangkaian atomik.

Import multipart: `plant_uuid:UUID!`, `kind:iw47|daily!`, `sap_system:string<=32` wajib saat iw47, `file:xlsx|xls|csv! <=10240 KB`. Respons ImportBatch memuat uuid, filename, kind, status, created_at, rows_count dan rows bila sudah dimuat. Row: sheet, row_number, classification, issues[], normalized{}, raw_payload{}. Duplikasi plant/kind/checksum mengembalikan batch lama. Status queued/processing/staged/failed bukan laporan final. Frontend polling GET halaman partial snapshot; bukan endpoint status baru. Jangan menganggap unggah berhasil sama dengan rekonsiliasi selesai/posting SAP.

Dokumen: `plant_uuid:UUID!`, `format!` salah satu vehicle/heavy/yanmar/genset/plan/meter/fuel/volume/downtime/maintenance/personnel/quality, `start_date:date!`, `end_date:date! >=start_date`, `status:approved|all!`, nullable `equipment_uuid`, `operator_uuid`. Ekspor menambah `output:pdf|xlsx!`. Tidak mengirim dataset buatan. Model preview: title, subtitle, watermark nullable, columns:string[], rows:cell[][], total_rows, sections[{title,columns,rows,total_rows}], notes:string[], summary:string[]. Preview source membatasi 100 baris utama/50 per section dengan total lengkap; file akhir tidak dibatasi halaman UI. BBM ambiguity, source quality dan seluruh status mempertahankan watermark bisnis. Frontend memeriksa MIME/signature binary sebelum menawarkan unduhan; pesan menyebut berkas tersedia, bukan membuktikan file tersimpan di perangkat pengguna.

## Perubahan yang harus disepakati

Jangan implementasikan sepihak: bearer token pada web; backend/SPA terpisah; penggantian nama action/DTO; status HTTP/error envelope; paginasi referensi master; `can_edit/can_approve` per record; operation_id/idempotency web umum; helper assignment; export async dengan job/download endpoint; ledger stok/reset/amendment; SAP cancellation/allocation/reconciliation; kebijakan wajib bukti dan approval bertingkat. Semua ini adalah dependency/kontrak usulan, bukan endpoint yang sudah dipanggil frontend. Zona per plant sudah diputuskan dan diterapkan di web memakai field existing; penyesuaian mobile dan UAT backend tetap dalam handover.

# Status implementasi dan verifikasi

Tanggal: 23 Oktober 2026. Laporan mencakup tahap frontend/handover terbaru dan riwayat implementasi sebelumnya. **Kesiapan produksi belum dinyatakan.**

## Finalisasi struktur dan keputusan zona per plant — tahap terbaru

Lihat [indeks](00-INDEX.md) dan [audit final](FINAL-AUDIT.md) untuk peta folder, matriks requirement→route/permission/service/data/output/test seluruh17 modul, keluaran O-01–16 dan temuan F-01–10. Tahap ini dimulai dengan audit baca-saja dan baseline19 test frontend; tidak menjalankan backend, SQL, provisioning, worker atau perubahan runtime.

- Keputusan pengguna F-02: dukung zona masing-masing plant. Helper web memakai timezone DTO existing untuk tampilan dan input dua arah ISO UTC, mempertahankan detik dan tanggal kalender. WIB/WITA/WIT, lintas malam, timezone invalid dan DST ambigu/gap diuji. Mobile masih +07 dan diserahterimakan.
- Tiga test regresi membuktikan metrics tidak lengkap dapat lolos, MIME serupa PDF diterima dan whitespace menjadi0. Guard/MIME/formatter diperbaiki; hanya dua bucket kosong PHP `[]` dinormalkan menjadi kamus kosong tanpa membuat data hilang.
- Kontrak web/API diperjelas. F-03 filter assignment/breakdown/WO, F-04 bootstrap concurrency, F-09 gap output dan F-10 respons mobile tetap backlog backend/mobile. Tidak menambahkan endpoint, tabel, fake auth, gallery atau dataset produk.
- **30 test frontend/0 gagal**, `tsc --noEmit --incremental false`, build web, formatter, mobile typecheck dan3 test retry/lease lulus. **78 file PHP lulus syntax lint** tanpa boot Laravel. Suite PHP historis di bagian bawah tidak dijalankan ulang.
- Empat PDF/XLSX QA historis dibuka; Yanmar dirender ulang dari file PDF ke temp, tipe cell/print title diperiksa. Artefak bukan output baru dari source terkini atau data perusahaan; pengesahan foto asli, field stok/kumulatif/hierarchy dan O-09/12/14/15 masih belum selesai.
- Backend/config/migrations/mobile/env/runtime/views dan dependency dipertahankan; perbandingan baseline akhir dicatat pada audit final. Checkpoint frontend/docs tahap ini: `/var/folders/ts/d_thqp0560v2tbp7xrchbw440000gn/T/epita-finalization-20261023-kv0j7ufa/frontend-docs-before.tar.gz`.

Paragraf berikut adalah riwayat tahap sebelumnya. Angka19 test frontend dan30 test PHP historis berbeda dari30 test frontend tahap terbaru. UAT browser seluruh modul dan SQL Server perusahaan masih menunggu akses sah.

## Tahap frontend dan handover — instruksi lanjutan

Instruksi terbaru membatasi pekerjaan pada frontend dan bahan serah terima. Backend/server perusahaan ditangani pengembang yang ditunjuk. Bagian-bagian setelah laporan tahap ini menjelaskan pekerjaan historis sebelumnya; keberadaan source/service dan hasil test historis bukan bukti backend sudah berjalan di perusahaan.

### Perubahan frontend

- `lib/http.ts` menyatukan JSON, multipart dan binary dengan session/CSRF. HTTP 200 dengan JSON rusak/HTML/login redirect tidak dianggap acknowledgment. Error 401/403/404/409/419/422/429/5xx ditangani konsisten; request reference disertakan pada error HTTP, detail error 5xx tidak ditampilkan mentah. Tidak ada retry otomatis mutasi.
- `lib/contracts.ts` memeriksa snapshot/acknowledgment UUID dan versi, identitas hasil terhadap request, import identity serta struktur dokumen. Toast sukses hanya sesudah acknowledgment yang dapat dibaca. Ekspor memeriksa MIME dan signature PDF/ZIP sebelum menawarkan file; tidak mengklaim file telah tersimpan di perangkat pengguna.
- Laporan memakai field request yang sesuai kontrak. Versi hasil save dan progres bukti dipertahankan bila unggahan berikutnya gagal; UUID lampiran tetap per File dan file yang sudah diakui tidak diantrekan ulang oleh form. Field error nested diarahkan ke langkah aktivitas/BBM yang relevan, tanpa menghapus input. Equipment draft yang sudah mendapat versi server tidak dapat diganti di form.
- Total penugasan memakai `metrics.assignments`, bukan panjang halaman. Realisasi rencana/angka invalid yang belum tersedia ditampilkan `—`, bukan nol. Tabel resource tanpa metadata pagination menjelaskan total belum tersedia dan tidak mengarang pagination lokal. Riwayat impor memakai total server dan detail terpilih mengikuti snapshot terbaru.
- Error/recovery UI konsisten, ada aksi masuk kembali saat sesi habis dan retry untuk pembacaan. Field error memiliki aria-invalid/description, login help mempunyai expanded state, fokus keyboard terlihat, judul dialog unik dan keyboard ditangani dialog teratas. Pending state mencegah aksi ganda. Label status bisnis dan pratinjau dokumen dipertahankan.
- CSS environment badge lama yang tidak terpakai dibuang. Sidebar tidak lagi menampilkan titik yang dapat disalahartikan sebagai koneksi aktif. Audit source React/CSS/view dan bundle tidak menemukan kredensial bersama, generator/fallback dataset atau jalur workspace sintetis. Penghapusan key legacy `epita.preview.v1` di app.tsx tetap hanya cleanup, bukan penyimpanan transaksi. Kata prototype pada library bundle bukan penanda produk dan tidak dihapus global.

### Bahan handover

- [FRONTEND-CONTRACT.md](FRONTEND-CONTRACT.md): route yang ditemukan, props/DTO, filter/pagination/KPI, seluruh action web → service, kamus field wajib/nullable, permission, respons UUID/versi, status error, workflow dan state UI. Memisahkan perilaku yang dibaca, test frontend dan usulan kontrak.
- [BACKEND-HANDOVER.md](BACKEND-HANDOVER.md): pembagian pemilik pekerjaan, entitas/relasi, role/plant, 12 kelompok pekerjaan backend konkret, nama environment tanpa credential, kebutuhan server, kompatibilitas/idempotency mobile, serta 17 acceptance criteria integrasi.
- README, arsitektur dan checklist SQL Server diarahkan ke handover. Istilah entitas “sudah dimigrasikan” diperjelas menjadi definisi pada source migrasi; penerapan perusahaan belum dibuktikan.

### Verifikasi tahap ini

- **19 test frontend lolos** lewat `node --test tests/frontend/*.test.mjs`: HTTP/CSRF/multipart, format rusak/redirect/error/reference, binary download, acknowledgment/identity/version, dokumen, null/zero, field ARIA, dialog unik, total server dan render modul/form.
- `npm run typecheck`, `npm run build`, `npm run format:check` lolos. Tidak ada dependency baru atau perubahan versi package/runtime.
- Render React/Inertia terisolasi mencakup sepuluh modul non-lazy, dashboard terpisah, login, editor laporan dan sembilan jenis form master/operasional/maintenance. Fixture hanya di test dan hasil statis sementara; tidak ada route pengguna, sesi palsu, database test yang dimigrasi, server QA atau galeri baru.
- Browser halaman login berjalan pada viewport panel 758 CSS px: tidak ada overflow horizontal, input email 14 px, bantuan akses dapat dibuka, toggle password kembali tersembunyi, Tab dari bantuan menuju password. Tidak mengirim login atau membuat akun.
- Browser menolak protokol `file://` untuk membuka render QA lokal. Karena itu render statis tiga ukuran tidak dihitung sebagai verifikasi visual browser desktop/tablet/mobile. Interaksi seluruh modul/form/grafik, layout tiga viewport dan perangkat nyata tetap menunggu UAT dengan environment perusahaan; tidak dibuat akses autentikasi pengganti.
- Baseline hash file backend/app/bootstrap/config/routes/database/bin/views, .env, composer dan mobile dibandingkan setelah pekerjaan: tidak berubah. Package.json/package-lock/vite config juga dibandingkan checkpoint dan tetap sama. Tidak menjalankan migration, seed, provisioning, worker/scheduler, pengaturan server atau deploy pada tahap ini. Suite PHP historis tidak dijalankan ulang pada tahap frontend.

Checkpoint frontend/docs sebelum perubahan: `/var/folders/ts/d_thqp0560v2tbp7xrchbw440000gn/T/epita-frontend-20261023-9khplmql/source-before.tar.gz`. Environment dan credential tidak disalin ke checkpoint tersebut. **Koneksi SQL Server, akun perusahaan dan pengesahan go-live tetap di luar hasil tahap ini.**

## Audit, baseline dan pemulihan

- Tidak terdapat repository Git. Checkpoint source sebelum perubahan dibuat di `/var/folders/ts/d_thqp0560v2tbp7xrchbw440000gn/T/epita-before-20261023-_3saf4fq.tar.gz` (159 file, SHA-256 `38ab1f0c70a979da40ac57ff957615fcb963e00890f461a231f2033f1537a117`). Environment privat, vendor, node_modules, storage dan output tidak dimasukkan.
- Baseline: 30 test / 322 assertion, PHP 8.4.25, Laravel 13.38.0; service workflow nyata sudah tersedia. Sumber masalah: jalur sesi demo terpisah, mutasi browser, dan snapshot berlimit yang dipakai sebagai total/export.
- Berkas yang diperiksa meliputi routes web/API, AuthController, WorkspaceController, OperationsController, Access, WorkspaceData, ReportWorkflow, PlanningService, MaintenanceService, SyncService, WorkbookImporter, ExportService, provisioning, migrasi/model, komponen React/CSS dan suite pengujian.
- Tidak ada database perusahaan yang dimigrasi, di-reset, di-seed atau dibersihkan. Cache browser yang dibersihkan hanya key sintetis teridentifikasi `epita.preview.v1`; sesi lama khusus demo juga dilupakan tanpa mengubah permission pengguna perusahaan.

## Perubahan yang diterapkan

| Area | Implementasi dan hasil |
|---|---|
| Akses sintetis | DemoAccounts, PreviewOnly, generator frontend, sample-export command, route `/preview/*`, kredensial bersama dan applyPreview/localStorage mutation dihapus. Fixture pengujian tetap terisolasi. Build tidak memuat kredensial atau fungsi mutasi sintetis. |
| Login dan scope | Hash Laravel, akun aktif, sesi/regenerasi/logout dan membership plant. Web menjelaskan akun tanpa plant; login API menolak menerbitkan token bila membership tidak tersedia. Operator dibatasi pada laporan, personel dan equipment terkait. |
| Mutasi web | Semua aksi melalui WorkspaceController → service aplikasi → transaksi DB. Snapshot respons berasal dari server; `mutation.uuid/version` memperbarui versi form. Tidak ada sukses lokal palsu. |
| Master | Create/edit/nonaktif equipment, personel dan lokasi; version conflict; kode unik scoped; induk lokasi harus dalam plant dan tidak membentuk siklus. Kode/unit equipment yang memiliki histori tetap dilindungi. |
| Rencana/penugasan | Validasi satuan target, jenis operator, interval penugasan dan periode rencana; benturan operator/alat dan downtime tetap diperiksa service. |
| Laporan/BBM | Workflow, konfirmasi, immutable final, histori, self-approval, BBM ambigu dan version check dipertahankan. Persetujuan shift lebih awal tidak menurunkan meter equipment yang lebih mutakhir. Provenance web/api/sync ditetapkan caller server, bukan payload pengguna. |
| KPI dan daftar | Agregasi SQL lengkap per periode, pagination/filter/search server untuk laporan, master, penugasan/rencana, BBM, WO/breakdown dan batch impor. Grafik memakai agregasi server; cutoff dan total tersedia. Filter periode daftar daily-reports API memakai query service yang sama. |
| Dokumen | Query ekspor lengkap terpisah dari pagination layar; format, periode, status, equipment/operator dan plant diperiksa server. Dataset client diabaikan. Pratinjau membatasi 100 baris utama / 50 per bagian dengan total yang jujur; ekspor tetap lengkap. |
| PDF besar | Tabel HTML 505 baris terbukti kehabisan memori 128 MB. Ditambahkan PdfTableWriter menggunakan CPDF yang sudah ada, dengan teks terbungkus, header tabel berulang dan pagination. Regresi 505 baris menghasilkan 26 halaman tanpa menaikkan memory_limit global. |
| Bukti | Storage privat, MIME/ukuran, checksum, UUID lampiran stabil, akses scoped dan replay tanpa duplikasi. Form mempertahankan versi hasil save jika unggahan berikutnya gagal. |
| UI/UX | Token palet existing dipertahankan, teks tabel/input/label diperbesar, kontras teks utama/caption/nav diperbaiki, loading/error/empty dipisahkan, form dirty dilindungi, pesan 404/403/503 berbahasa Indonesia dengan request ID. |
| Impor dan mobile | Parser/staging serta antrean impor existing dipertahankan; UI memeriksa progres queued/processing. Kontrak UUID/version/error dan sync receipts mobile tetap dipertahankan. Tidak ada pembuatan ulang mobile. |

## Runtime dan koneksi

| Pemeriksaan | Bukti |
|---|---|
| PHP CLI | 8.4.27 melalui bin/php, runtime proyek .runtime/php84 |
| PHP server web lokal | Header HTTP `/login`: PHP/8.4.27, HTTP 200 |
| Laravel | 13.38.0; requirement major 13 dipertahankan |
| Dependency | composer.lock diperbarui untuk minimum PHP ~8.4.27; perbandingan baseline menunjukkan tidak ada versi package yang berubah |
| Extension | pdo_sqlsrv, sqlsrv, bcmath, mbstring, XML/DOM, ZIP tersedia; Composer platform checks lolos |
| SQL Server | Default driver sqlsrv, enkripsi/certificate validation dipertahankan. Kredensial belum terisi; epita:check --database keluar gagal dan menandai konfigurasi/koneksi BELUM. |
| Worker/scheduler | Perintah memakai wrapper runtime yang sama; worker dan scheduler environment tujuan belum diverifikasi karena koneksi SQL Server belum tersedia |

## Pengujian yang dijalankan

- PHPUnit terbaru: **30 test, 288 assertion**, lolos. Test lama yang mensyaratkan demo diganti dengan pengujian akses perusahaan dan penutupan route sintetis. Test workflow yang masih benar dipertahankan.
- TestCase menolak environment selain `testing` + SQLite `:memory:` sebelum trait migrasi berjalan; variabel database test dipaksa pada phpunit.xml. Ini bukan bukti SQL Server nyata.
- Kasus batas: **505 laporan, 105 rencana, 205 WO** di database test. Total meter 505 HM dan ekspor 505 baris lengkap; tabel layar berisi 8 baris/halaman. Pratinjau layar 100/505 baris; output lengkap tetap dibaca server.
- Login perusahaan, akun nonaktif/tanpa membership, logout, akses operator/lintas plant, data client yang tidak dipercaya, error database tanpa detail privat, optimistic concurrency, hierarki lokasi, bukti privat/idempotent, self-approval, BBM dan replay sync diuji.
- TypeScript web, build Vite, Prettier, Pint serta Composer validate/platform checks lolos. Tidak ada Git sehingga Pint dijalankan langsung pada file/direktori source, bukan --dirty.
- TypeScript mobile dan tiga test retry/lease lolos; bukan bukti perangkat atau SQLCipher native.
- Browser lokal: login tanpa akun uji; permintaan login saat DB tidak tersedia menampilkan kegagalan dan request ID; URL sintetis 404. Screenshot dan pemeriksaan overflow dilakukan pada viewport panel sekitar 758 CSS px. Dashboard perusahaan dan seluruh viewport desktop/ponsel belum dapat diverifikasi dengan SQL Server nyata.
- Empat template pendek menghasilkan Excel/PDF. PDF kendaraan yang sebelumnya menyisakan halaman tanda tangan dirapikan menjadi satu halaman; kendaraan/alat berat/Yanmar/genset dirender ke PNG dan diperiksa. PDF meter 505 baris diperiksa halaman awal, tengah dan akhir; seluruh baris dan footer terdeteksi. Artefak ini berasal dari fixture database test, bukan laporan perusahaan.
- Rasio kontras pasangan token terpilih: teks muted pada putih 5,53; pada latar 5,15; teks navy pada CTA kuning 8,85; navigasi 8,04; active nav 10,02. Ini bukan audit aksesibilitas lengkap semua state.

## Acceptance criteria dan batas bukti

| ID | Status |
|---|---|
| A-01 | Lolos di database test; login/dashboard SQL Server nyata belum terverifikasi |
| A-02–04 | Lolos: akses sintetis ditutup; mutasi memakai backend; pratinjau bisnis tetap memakai data server |
| A-05 | Persistensi/reload diuji pada SQLite test; browser baru dan SQL Server nyata belum terverifikasi |
| A-06 | Lolos test dan browser: kegagalan jujur, tanpa fallback atau sukses palsu |
| A-07 | CLI/web 8.4.27 dan Laravel 13 terkonfirmasi; worker/scheduler tujuan belum terkonfirmasi |
| A-08–11 | Lolos suite domain lokal untuk scope, bukti, workflow, BBM, meter/lintas hari/satuan/union; concurrency SQL Server tetap perlu uji |
| A-12 | Lolos untuk 505/105/205 di test serta PDF besar; bukan bukti kapasitas 100k aktivitas |
| A-13 | Query server, filter, metadata pagination dan ekspor lengkap diterapkan; keseluruhan interaksi UI dengan server perusahaan masih perlu UAT |
| A-14 | Parser/provenance/staging diuji dengan workbook sintetis; workbook perusahaan dan mapping/alokasi final belum tersedia |
| A-15 | Empat format dan pagination diperiksa lokal; belum dibanding foto asli/disahkan pemilik proses |
| A-16 | Tidak ada akses/generator/data sintetis pada jalur produk; fixture/factory/artefak QA hanya untuk pengujian |
| A-17–18 | State dan komponen diperbaiki; login/error ditinjau di panel browser. UAT seluruh formulir/halaman, keyboard, desktop dan perangkat tetap diperlukan |
| A-19 | Build, tipe, formatter, tests dan pemeriksaan visual yang dijelaskan di atas lolos |
| A-20 | Replay/stale version serta typecheck/test mobile dipertahankan; perangkat nyata belum diuji |

## Yang belum selesai dan masukan yang diperlukan

1. **Infrastruktur:** endpoint dan akun SQL Server yang disahkan di .env; database test SQL Server terpisah, storage privat, worker dan scheduler. Setelah tersedia: cek koneksi, tinjau migrate:status/migrate --pretend, backup/pemulihan, lalu migrasi dan provisioning privat. Belum ada klaim migrasi atau akun perusahaan berhasil dibuat.
2. **Sumber bisnis:** kedua workbook dan foto asli. Diperlukan untuk memverifikasi mapping identitas, saldo/kumulatif, format cetak, aturan pembatalan SAP dan alokasi lintas periode. Tidak ada hasil rekonsiliasi yang direkayasa.
3. **Fitur lanjutan:** proses mapping/alokasi/rekonsiliasi SAP final, antrean ekspor sangat besar/streaming end-to-end, 100k aktivitas/P95, amendment final, meter reset, kalender/periode dan seluruh master/admin lanjutan belum lengkap.
4. **Keputusan proses:** kewajiban bukti per kondisi/kategori, kebijakan rilis/approval bertingkat dan pengesahan format. Jangan mengaktifkan aturan yang belum disahkan dengan asumsi buatan.
5. **UAT:** SQL Server locking/constraint/decimal, browser lintas akun/plant, perangkat mobile, upload nyata, backup/restore dan pengesahan pemilik proses sebelum pilot.

Migrasi tambahan `2026_10_22_185859_add_workspace_query_indexes.php` hanya menambah indeks rencana/WO/breakdown/downtime. Migrasi lama tidak diubah. PRD dan master prompt asli dipertahankan sebagai sumber spesifikasi.


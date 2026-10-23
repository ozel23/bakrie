# EPITA Bakrie

Sistem operasional alat berat, kendaraan, mesin pabrik dan genset. Backend Laravel, frontend React + Inertia, database web SQL Server. Produk menggunakan Bahasa Indonesia.

## Status saat ini

Mulai dari [indeks dokumen](docs/00-INDEX.md) dan [audit final 17 modul/16 keluaran](docs/FINAL-AUDIT.md). Audit terbaru memperbaiki frontend serta dokumentasi; temuan backend/mobile diteruskan sebagai backlog, tanpa mengubah backend/server. Zona waktu web sekarang mengikuti masing-masing plant sesuai keputusan pengguna.

Penyempurnaan 23 Oktober 2026 mengakhiri workspace dan akun percobaan. Login hanya memakai akun perusahaan, hash Laravel dan membership plant. Mutasi web melewati backend. Tidak ada pengganti data ketika SQL Server tidak tersedia.

**SQL Server belum terhubung:** kredensial pada environment lokal belum tersedia. Login perusahaan dan persistensi SQL Server belum dapat dibuktikan pada server nyata. Tidak ada data perusahaan yang dihapus, diubah, diimpor atau di-seed selama pekerjaan ini. Lihat [bukti implementasi dan acceptance criteria](docs/IMPLEMENTATION.md).

## Runtime dan server lokal

Audit terbaru memverifikasi `bin/php` **8.4.27**; PHP default PATH **8.2.33** dan Herd `php84` **8.4.25** belum memenuhi requirement `~8.4.27`. Gunakan wrapper proyek. Header web lokal **8.4.27** adalah bukti tahap sebelumnya; runtime web/worker perusahaan belum diverifikasi. Laravel terkunci **13.38.0**; versi package dipertahankan.

```bash
bin/php -v
bin/php artisan epita:check
bin/php artisan serve --host=127.0.0.1 --port=8000 --no-reload
```

Buka [login EPITA](http://127.0.0.1:8000/login). Tidak tersedia sandi bersama atau daftar akun uji. Pengguna yang belum memiliki plant aktif menerima penjelasan untuk menghubungi administrator.

`bin/php` memprioritaskan `EPITA_PHP`, lalu `.runtime/php84`, lalu PHP 8.4 pada PATH. Wrapper memerlukan PHP 8.4.27 atau patch 8.4 yang lebih baru. Runtime lokal berada di `.runtime/` yang diabaikan Git; PHP global dan proyek lain tidak diubah. Binary arm64 diperoleh melalui HTTPS dari penyedia resmi Laravel Herd: `https://download.herdphp.com/8.4/8.4.27/php84-arm64`. SHA-256 lokal: `cd678c1452f6cac79f9a297038284795f1ef78f792c506c7e743fcfcd373aaa5`.

Pada host lain, pasang runtime yang sesuai dan arahkan `EPITA_PHP` ke binary tersebut. Composer `config.platform` tidak dipakai untuk menyamarkan versi runtime. Worker/scheduler environment tujuan perlu memakai runtime yang sama dan masih memerlukan verifikasi.

## Koneksi SQL Server dan provisioning

Isi `.env` secara lokal menggunakan endpoint, nama database dan akun aplikasi yang disahkan. Simpan kata sandi hanya di environment/private secret store. Jangan commit atau menyalin connection string ke log.

```dotenv
DB_CONNECTION=sqlsrv
DB_HOST=
DB_PORT=1433
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=
DB_ENCRYPT=yes
DB_TRUST_SERVER_CERTIFICATE=false
DB_LOGIN_TIMEOUT=5
```

Setelah akses server tersedia:

```bash
bin/php artisan epita:check --database
bin/php artisan migrate:status
bin/php artisan migrate --pretend
# Tinjau perubahan dan siapkan pemulihan pada environment tujuan sebelum menerapkan:
bin/php artisan migrate
bin/php artisan epita:provision
```

Pada instalasi baru saja, jalankan `bin/php artisan key:generate` setelah menyalin environment. Pertahankan APP_KEY yang sudah ada pada instalasi existing. Script setup tidak menerapkan migrasi atau mengganti key secara otomatis.

Provisioning interaktif meminta identitas perusahaan/plant, pengguna, role dan kata sandi privat minimal 12 karakter. Command menolak menimpa akun yang sudah ada. Tidak ada transaksi operasional otomatis. Administrator tidak otomatis memiliki izin persetujuan.

Migrasi tambahan indeks query periode berasal dari tahap implementasi sebelumnya. Pada tahap frontend/audit terbaru tidak ada perubahan migrasi atau eksekusi backend. Tidak ada `migrate:fresh`, wipe atau reseed database perusahaan yang dijalankan. Uji SQL Server harus memakai database pengujian terpisah sebelum rollout.

Setelah database dan storage privat siap, jalankan worker dengan `bin/php artisan queue:work --tries=3`. Queue impor tersedia; antrean ekspor sangat besar dan rekonsiliasi SAP final belum lengkap. Jangan membuka akses operasional sebelum pengujian environment tujuan selesai.

## Frontend

Tahap frontend dan handover tidak mengubah backend/database/server. Pekerjaan berikutnya pada Laravel dan SQL Server dilakukan pengembang yang ditunjuk pengguna. Mulai dari [handover backend](docs/BACKEND-HANDOVER.md) dan [kontrak frontend](docs/FRONTEND-CONTRACT.md).

Verifikasi terbaru: 30 test frontend, typecheck web/mobile, build web, 3 unit test mobile dan syntax lint78 file PHP lulus; suite backend tidak dijalankan ulang. SQL Server/login perusahaan, concurrency dan native mobile belum terbukti. F-03 filter API, F-04 bootstrap cursor, F-09 kelengkapan output dan F-10 guard mobile tetap terbuka di audit final.

```bash
npm ci
npm run typecheck
npm run build
# Pengembangan dengan Vite, pada terminal terpisah:
npm run dev
```

Daftar utama memakai filter/pagination server. KPI dan grafik berasal dari agregasi seluruh periode terotorisasi. Pratinjau dokumen dan file akhir memakai query serta kalkulasi yang sama; layar membatasi baris tampilan dan menyebut total hasil. Ekspor mengambil seluruh hasil, bukan halaman tabel yang sedang dibuka.

PDF besar menggunakan writer tabel vektor dari library yang sudah terpasang untuk menghindari penggunaan memori DOM yang besar. Empat template pendek tetap memakai layout HTML existing. Tidak ada dependency baru yang ditambahkan.

## Pengujian

Perintah backend di bawah adalah acuan untuk tahap backend pada database uji terpisah; tidak dijalankan pada finalisasi frontend. Hasil terbaru dan batas bukti ada di audit final.

```bash
bin/php artisan test --compact
npm run typecheck
npm run build
npm run format:check
node --test tests/frontend/*.test.mjs
npm run typecheck --prefix mobile
npm run test --prefix mobile
```

Suite PHP memaksa environment `testing` dan SQLite `:memory:` serta memeriksa isolasi sebelum trait migrasi berjalan. SQLite ini hanya untuk pengujian otomatis, bukan database web. Fixture/factory terisolasi tidak memiliki route masuk ke produk.

## Mobile

Source Expo/React Native dan kontrak UUID/version/error/idempotency dipertahankan. Login pertama memerlukan API online; token disimpan aman, cache/outbox mobile tetap SQLite/SQLCipher. Tidak ada perubahan besar UI mobile. Pengujian perangkat, foto nyata, pencabutan token dan SQL Server tetap diperlukan.

## Dokumen acuan

- [Indeks dan urutan acuan terbaru](docs/00-INDEX.md)
- [Audit final struktur, matriks modul/output dan temuan](docs/FINAL-AUDIT.md)
- [PRD asli](docs/01-PRD-EPITA.md)
- [Master prompt asli](docs/02-MASTER-PROMPT.md)
- [Arsitektur](docs/ARCHITECTURE.md)
- [Kontrak API](docs/API.md)
- [Kontrak frontend web dan kamus mutasi](docs/FRONTEND-CONTRACT.md)
- [Handover untuk pengembang backend](docs/BACKEND-HANDOVER.md)
- [Status implementasi dan bukti](docs/IMPLEMENTATION.md)

Workbook dan foto asli yang disebut spesifikasi belum tersedia di workspace. Template, mapping dan aturan pembatalan/alokasi SAP tetap memerlukan verifikasi sumber serta pengesahan pemilik proses. Aplikasi belum dinyatakan siap produksi.

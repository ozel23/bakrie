# Pengujian SQL Server pada tahap berikutnya

Belum dijalankan, sesuai instruksi pengguna untuk menunda database.

Daftar ini diserahkan kepada pengembang backend yang ditunjuk. Tahap frontend tidak menjalankan konfigurasi, migrasi, provisioning atau perintah di server perusahaan. Rincian kontrak dan acceptance criteria: [BACKEND-HANDOVER.md](BACKEND-HANDOVER.md).

Gunakan database pengujian khusus, dengan nama berbeda dari data perusahaan dan akun berizin terbatas. Jangan menjalankan `migrate:fresh` terhadap database operasional.

1. Verifikasi target PHP 8.4.27, Laravel 13, versi driver `pdo_sqlsrv`/ODBC yang didukung, TLS dan sertifikat.
2. Isi koneksi `.env` lokal; jalankan `bin/php artisan epita:check --database`.
3. Jalankan migrasi pada database pengujian kosong. Pastikan tidak ada multiple cascade paths, index key terlalu panjang, atau tipe unsupported.
4. Uji DECIMAL(18,3), leading zero pada string kode, null vs zero, work date, dan UTC timestamps.
5. Uji transaksi draft+detail+fuel+approval snapshot, dan rollback saat salah satu detail gagal.
6. Uji dua request serentak pada assignment alat/operator, version conflict report, approval ganda, stable attachment UUID, dan replay operation UUID.
7. Uji user nonaktif, membership dicabut, cross-plant URL/API/export/private attachment, serta kewenangan job setelah antrean dibuat.
8. Uji batch impor identik, identitas confirmation/counter berubah, original rows subtotal, tanggal Excel dan cancellation unresolved.
9. Uji dataset 100.000 aktivitas, query/pagination/filter server, queue export, memori, waktu respon dan indeks.
10. Uji backup/restore SQL Server bersama storage privat; dokumentasikan durasi dan hasil pemeriksaan konsistensi.

SQLite in-memory pada test saat ini sengaja hanya membuktikan aturan aplikasi lokal. Jangan melabelinya sebagai test integrasi SQL Server.

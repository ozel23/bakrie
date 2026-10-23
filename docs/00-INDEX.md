# Indeks dan urutan acuan EPITA

Diperbarui 23 Oktober 2026. Pemilik dokumen frontend: pekerjaan ini; pemilik implementasi Laravel, SQL Server dan server: pengembang backend yang ditunjuk pengguna.

## Urutan penggunaan

1. Instruksi dan keputusan terbaru pengguna mengatur ruang lingkup: database ditunda; finalisasi ini hanya mengubah frontend, pengujian frontend dan dokumentasi. Backend, mobile, konfigurasi dan server dibaca saja.
2. [PRD asli](01-PRD-EPITA.md) adalah baseline kebutuhan produk. Keberadaan kebutuhan tidak berarti fiturnya sudah diterapkan.
3. [Audit final struktur](FINAL-AUDIT.md) mencatat keadaan source terbaru, 17 modul, O-01–O-16, F-01–F-10, bukti dan dependency. Gunakan status di sini untuk membaca dokumen historis.
4. [Kontrak frontend](FRONTEND-CONTRACT.md) adalah kamus canonical caller web existing: Inertia/session/CSRF, props, field/action, acknowledgment dan error. [API v1](API.md) adalah kontrak caller mobile existing beserta keterbatasannya. Perbedaan keduanya disengaja; web tidak memakai token perangkat.
5. [Handover backend](BACKEND-HANDOVER.md) adalah pekerjaan dan acceptance test untuk pengembang backend; bukan bukti pekerjaan itu sudah dijalankan. [Checklist SQL Server](SQL-SERVER-CHECKLIST.md) dipakai pada tahap backend dengan database uji terpisah.
6. [Arsitektur](ARCHITECTURE.md) menjelaskan struktur source. [Catatan implementasi](IMPLEMENTATION.md) menyimpan riwayat verifikasi, dengan pembaruan terbaru di atas.
7. [Master prompt asli](02-MASTER-PROMPT.md) dipertahankan sebagai arsip arahan awal. Instruksi pembangunan backend, provisioning, dataset percobaan atau deployment di arsip tidak memperluas scope frontend terbaru.

Keputusan F-02 dari pengguna: **dukung zona waktu masing-masing plant**. Web memakai `plant.timezone` existing, konversi dua arah dan tanggal kerja terpisah. Mobile masih perlu disesuaikan oleh pemilik mobile/backend; keputusan ini bukan lagi pertanyaan terbuka.

## Pemetaan nama dokumen pada lampiran

| Sebutan lampiran | File yang tersedia di workspace | Perlakuan |
|---|---|---|
| 01 / PRD | `01-PRD-EPITA.md` | Sumber kebutuhan; isi asli dipertahankan |
| 02 / master prompt | `02-MASTER-PROMPT.md` | Arsip, tidak mengalahkan scope terbaru |
| 03 / arahan tahap terdahulu | Tidak ditemukan file bernomor 03 | Riwayat yang tersedia dicatat di IMPLEMENTATION; tidak mengarang isi file yang hilang |
| 04 / kontrak frontend | `FRONTEND-CONTRACT.md` | Padanan fungsi lokal; bukan klaim identik dengan file eksternal |
| 05 / `05-BAHAN-HANDOVER-BACKEND-COMPANY.md` | Nama tersebut tidak ditemukan; `BACKEND-HANDOVER.md` tersedia | Gunakan handover lokal dan audit final; isi file eksternal belum diperiksa |
| Prompt finalisasi/audit terbaru | Lampiran percakapan bertanggal 23 Oktober 2026 | Dasar audit baca-saja lalu implementasi frontend/docs yang diotorisasi |

Jangan menyalin ulang payload ke banyak dokumen. Matriks audit merujuk kamus kontrak; usulan endpoint/schema baru harus tetap diberi label usulan. Hasil lokal, test terisolasi, source yang dibaca, integrasi perusahaan dan keputusan bisnis selalu dibedakan. Tidak ada dokumen ini yang mengesahkan go-live.

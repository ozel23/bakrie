<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CheckReadiness extends Command
{
    protected $signature = 'epita:check {--database : Periksa koneksi SQL Server yang dikonfigurasi}';

    protected $description = 'Periksa runtime EPITA tanpa membuat data atau mengubah database';

    public function handle(): int
    {
        $this->line('PHP CLI: '.PHP_VERSION.' · Laravel: '.app()->version());
        $checks = ['PHP 8.4.27 atau patch 8.4 lebih baru' => str_starts_with(PHP_VERSION, '8.4.') && version_compare(PHP_VERSION, '8.4.27', '>='), 'Laravel 13' => str_starts_with(app()->version(), '13.'), 'BCMath' => extension_loaded('bcmath'), 'Driver pdo_sqlsrv' => extension_loaded('pdo_sqlsrv'), 'mbstring' => extension_loaded('mbstring'), 'XML/DOM' => extension_loaded('xml') && extension_loaded('dom'), 'ZIP' => extension_loaded('zip'), 'Database default SQL Server' => config('database.default') === 'sqlsrv', 'Frontend build' => file_exists(public_path('build/manifest.json'))];
        if ($this->option('database')) {
            $configured = filled(config('database.connections.sqlsrv.url')) || (filled(config('database.connections.sqlsrv.host')) && filled(config('database.connections.sqlsrv.database')) && filled(config('database.connections.sqlsrv.username')) && filled(config('database.connections.sqlsrv.password')));
            try {
                $checks['Konfigurasi autentikasi SQL Server terisi'] = $configured;
                if ($configured) {
                    DB::connection('sqlsrv')->select('SELECT 1 AS connected');
                }
                $checks['Koneksi SQL Server'] = $configured;
            } catch (\Throwable) {
                $checks['Koneksi SQL Server'] = false;
            }
        }
        foreach ($checks as $label => $ok) {
            $this->line(($ok ? '[OK] ' : '[BELUM] ').$label);
        }$this->comment('Koneksi hanya diuji dengan --database dan konfigurasi yang lengkap. Worker, scheduler, SQL Server dan perangkat memerlukan verifikasi pada environment tujuan.');

        return in_array(false, $checks, true) ? self::FAILURE : self::SUCCESS;
    }
}

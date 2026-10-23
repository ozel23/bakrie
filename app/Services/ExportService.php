<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\Validator;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\Response;

class ExportService
{
    public function filters(array $input): array
    {
        $filter = Validator::make($input, ['format' => 'required|in:vehicle,heavy,yanmar,genset,plan,meter,fuel,volume,downtime,maintenance,personnel,quality', 'start_date' => 'required|date_format:Y-m-d', 'end_date' => 'required|date_format:Y-m-d|after_or_equal:start_date', 'status' => 'required|in:approved,all', 'equipment_uuid' => 'nullable|uuid', 'operator_uuid' => 'nullable|uuid'])->validate();
        $filter += ['equipment_uuid' => null, 'operator_uuid' => null];

        return $filter;
    }

    public function build(array $dataset, array $input, string $plantName = 'Plant sesuai kewenangan', string $timezone = 'Asia/Jakarta'): array
    {
        $filter = $this->filters($input);
        $format = $filter['format'];
        $equipment = collect($dataset['equipment'] ?? [])->keyBy('uuid');
        $people = collect($dataset['people'] ?? [])->keyBy('uuid');
        $locations = collect($dataset['locations'] ?? [])->keyBy('uuid');
        $reports = collect($dataset['reports'] ?? [])->filter(fn (array $r) => $r['work_date'] >= $filter['start_date'] && $r['work_date'] <= $filter['end_date'] && ($filter['status'] === 'all' || $r['status'] === 'approved') && (! $filter['equipment_uuid'] || $r['equipment_uuid'] === $filter['equipment_uuid']) && (! $filter['operator_uuid'] || $r['operator_uuid'] === $filter['operator_uuid']))->sortBy('work_date')->values();
        $category = ['vehicle' => 'vehicle', 'heavy' => 'heavy_equipment', 'yanmar' => 'engine', 'genset' => 'genset'][$format] ?? null;
        if ($category) {
            $reports = $reports->filter(fn (array $r) => ($equipment[$r['equipment_uuid']]['category'] ?? null) === $category);
        }
        $titles = ['vehicle' => 'Buku kendaraan harian / mingguan', 'heavy' => 'Buku harian alat berat', 'yanmar' => 'Laporan pemakaian mesin Yanmar', 'genset' => 'Laporan pemakaian genset', 'plan' => 'Rekap rencana dan realisasi', 'meter' => 'Rekap prestasi meter', 'fuel' => 'Rekap bahan bakar dan pelumas', 'volume' => 'Rekap volume pekerjaan', 'downtime' => 'Rekap ketidaktersediaan alat', 'maintenance' => 'Riwayat maintenance', 'personnel' => 'Riwayat aktivitas personel', 'quality' => 'Kualitas data dan sumber impor'];
        $doc = ['format' => $format, 'title' => $titles[$format], 'subtitle' => $plantName.' · '.$filter['start_date'].' s.d. '.$filter['end_date'].' · '.($filter['status'] === 'approved' ? 'Versi disetujui' : 'Seluruh status'), 'watermark' => $filter['status'] === 'all' ? 'BELUM DIVERIFIKASI' : null, 'columns' => [], 'rows' => [], 'sections' => [], 'notes' => ['Nilai kosong berarti belum tersedia / tidak berlaku; bukan nol terukur.', 'Kode dan satuan dipertahankan. Tidak ada posting langsung SAP/MM.'], 'summary' => []];
        $doc['source_label'] = in_array($format, ['maintenance', 'downtime'], true) ? 'Riwayat perawatan sesuai periode' : ($format === 'quality' ? 'Sumber impor belum diverifikasi' : ($format === 'plan' ? 'Rencana dan realisasi sesuai filter' : ($filter['status'] === 'approved' ? 'Laporan versi disetujui' : 'Seluruh status · belum diverifikasi')));
        if (in_array($format, ['quality', 'maintenance', 'downtime', 'plan'], true)) {
            $doc['subtitle'] = $plantName.' · '.$filter['start_date'].' s.d. '.$filter['end_date'].' · '.$doc['source_label'];
        }
        if ($format === 'quality') {
            $doc['watermark'] = 'BELUM DIVERIFIKASI';
        }
        $label = fn (string $value): string => ['receipt' => 'Pengisian', 'consumption' => 'Konsumsi', 'unverified' => 'Perlu verifikasi', 'direct' => 'Diukur langsung', 'stock_balance' => 'Neraca stok', 'estimate' => 'Estimasi', 'working' => 'Bekerja', 'standby' => 'Standby', 'maintenance' => 'Perawatan', 'breakdown' => 'Breakdown', 'approved' => 'Disetujui', 'draft' => 'Draft', 'submitted' => 'Dikirim', 'reviewed' => 'Diperiksa', 'returned' => 'Perlu revisi', 'open' => 'Terbuka', 'in_progress' => 'Dikerjakan', 'released' => 'Dirilis'][$value] ?? $value;
        $n = fn (mixed $v): ?float => $v === null || $v === '' ? null : (float) $v;
        $time = fn (?string $v): ?string => $v ? CarbonImmutable::parse($v)->setTimezone($timezone)->format('d/m H:i') : null;
        $getName = fn (array $r): string => $equipment[$r['equipment_uuid']]['name'] ?? 'Belum dipetakan';
        $operator = fn (array $r): string => $people[$r['operator_uuid']]['name'] ?? 'Belum dipetakan';
        $code = fn (array $r): string => $equipment[$r['equipment_uuid']]['code'] ?? 'Belum dipetakan';
        if ($format === 'vehicle') {
            $doc['columns'] = ['Tanggal', 'Kode / kendaraan', 'No. polisi', 'Sopir', 'KM awal', 'KM akhir', 'Jumlah KM', 'Berangkat', 'Kembali', 'Jam netto', 'Lokasi type / kode', 'Main / sub / uraian', 'Jenis muatan', 'Volume', 'Satuan', 'Keterangan'];
            foreach ($reports as $r) {
                foreach ($r['activities'] ?: [[]] as $a) {
                    $start = $a['meter_start'] ?? (count($r['activities']) <= 1 ? $r['meter_start'] : null);
                    $end = $a['meter_end'] ?? (count($r['activities']) <= 1 ? $r['meter_end'] : null);
                    $loc = $locations[$a['location_uuid'] ?? ''] ?? [];
                    $doc['rows'][] = [$r['work_date'], $code($r).' / '.$getName($r), $equipment[$r['equipment_uuid']]['plate'] ?? null, $operator($r), $n($start), $n($end), $start !== null && $end !== null ? $n(bcsub((string) $end, (string) $start, 3)) : null, $time($a['starts_at'] ?? null), $time($a['ends_at'] ?? null), $a ? $this->activityHours($a) : 0, ($loc['type'] ?? '').' / '.($loc['sap_code'] ?? $loc['code'] ?? ''), ($a['work_code'] ?? '').' / '.($a['description'] ?? ''), $a['cargo'] ?? null, $n($a['quantity'] ?? null), $a['unit'] ?? null, $r['notes'] ?? null];
                }
            }
            $weeks = [];
            foreach ($reports as $r) {
                $date = CarbonImmutable::parse($r['work_date']);
                $key = $date->startOfWeek()->format('Y-m-d');
                $weeks[$key] ??= ['meter' => '0.000', 'seconds' => 0];
                $weeks[$key]['meter'] = bcadd($weeks[$key]['meter'], (string) ($r['meter_delta'] ?? '0'), 3);
                $weeks[$key]['seconds'] += $r['work_seconds'] ?? 0;
            }
            $doc['sections'][] = ['title' => 'Subtotal minggu · kalender Senin–Minggu, diiris filter', 'columns' => ['Awal minggu', 'Total KM detail unik', 'Jam kerja netto'], 'rows' => collect($weeks)->map(fn ($v, $k) => [$k, (float) $v['meter'], $v['seconds'] / 3600])->values()->all()];
        } elseif ($format === 'heavy') {
            $doc['columns'] = ['Tanggal', 'Equipment', 'Nama alat', 'HM awal', 'HM akhir', 'Jumlah HM', 'Lokasi', 'Blok SAP', 'Uraian kegiatan', 'Volume', 'Satuan', 'Operator / helper', 'Kondisi / catatan'];
            foreach ($reports as $r) {
                foreach ($r['activities'] ?: [[]] as $i => $a) {
                    $loc = $locations[$a['location_uuid'] ?? ''] ?? [];
                    $helpers = collect($r['helpers'] ?? [])->map(fn ($h) => $people[$h['person_uuid']]['name'] ?? 'Belum dipetakan')->implode(', ');
                    $doc['rows'][] = [$r['work_date'], $code($r), $getName($r), $i === 0 ? $n($r['meter_start']) : null, $i === 0 ? $n($r['meter_end']) : null, $i === 0 ? $n($r['meter_delta']) : null, $loc['name'] ?? null, $loc['sap_code'] ?? null, $a['description'] ?? null, $n($a['quantity'] ?? null), $a['unit'] ?? null, $operator($r).($helpers ? ' / '.$helpers : ''), $label($r['condition']).' / '.($r['notes'] ?? '')];
                }
            }
        } elseif (in_array($format, ['yanmar', 'genset'], true)) {
            $doc['columns'] = ['Tanggal', 'Equipment / model', 'Solar awal (L)', 'Solar diterima (L)', 'Solar sisa (L)', 'Pagi: awal–akhir', 'Pagi: jam', 'Sore: awal–akhir', 'Sore: jam', 'Jam hari ini', 'Jam kumulatif', 'Solar dipakai (L)', 'Metode konsumsi', 'Solar kumulatif (L)', 'Rasio L/jam', 'Rasio kumulatif', 'kWh terukur', 'Keterangan'];
            foreach ($reports as $r) {
                $sessions = $r['activities'];
                $received = $this->fuelTotal($r, 'receipt');
                $used = $this->fuelTotal($r, 'consumption');
                $seconds = $r['work_seconds'] ?? 0;
                $doc['rows'][] = [$r['work_date'], $getName($r), $n($r['stock']['opening'] ?? null), $received === null ? null : $n($received), $n($r['stock']['closing'] ?? null), isset($sessions[0]) ? $time($sessions[0]['starts_at']).'–'.$time($sessions[0]['ends_at']) : null, isset($sessions[0]) ? $this->activityHours($sessions[0]) : null, isset($sessions[1]) ? $time($sessions[1]['starts_at']).'–'.$time($sessions[1]['ends_at']) : null, isset($sessions[1]) ? $this->activityHours($sessions[1]) : null, $seconds / 3600, null, $n($used), collect($r['fuel_events'])->where('meaning', 'consumption')->map(fn ($f) => $label($f['method']))->unique()->implode(', '), null, $used !== null && $seconds > 0 ? (float) bcdiv(bcmul($used, '3600', 9), (string) $seconds, 6) : null, null, null, $r['notes'] ?? null];
            }
            $doc['notes'][] = 'Saldo pembukaan, kumulatif, dan kWh tidak diisi tanpa pengukuran / pengesahan. Sesi tambahan tercantum di bagian sesi lengkap.';
            $doc['sections'][] = ['title' => 'Seluruh sesi operasi / pemanasan', 'columns' => ['Tanggal', 'Equipment', 'Mulai', 'Selesai', 'Jam netto', 'Uraian'], 'rows' => $reports->flatMap(fn ($r) => collect($r['activities'])->map(fn ($a) => [$r['work_date'], $getName($r), $time($a['starts_at']), $time($a['ends_at']), $this->activityHours($a), $a['description']]))->values()->all()];
        } elseif ($format === 'meter') {
            $doc['columns'] = ['Tanggal', 'Equipment', 'Nama alat', 'Shift', 'Meter awal', 'Meter akhir', 'Delta', 'Satuan', 'Jam kerja waktu', 'Status'];
            foreach ($reports as $r) {
                $doc['rows'][] = [$r['work_date'], $code($r), $getName($r), $r['shift'], $n($r['meter_start']), $n($r['meter_end']), $n($r['meter_delta']), $r['meter_unit'], ($r['work_seconds'] ?? 0) / 3600, $label($r['status'])];
            }
        } elseif ($format === 'fuel') {
            $doc['columns'] = ['Tanggal', 'Equipment', 'Bahan', 'Makna', 'Kuantitas', 'Satuan', 'Metode', 'Verifikasi', 'Tempat', 'SAP MM'];
            foreach ($reports as $r) {
                foreach ($r['fuel_events'] as $f) {
                    $doc['rows'][] = [$r['work_date'], $code($r), $f['fuel_type'], $label($f['meaning']), $n($f['quantity']), $f['unit'], $label($f['method']), empty($f['verified_at']) ? 'Belum diverifikasi' : 'Terverifikasi', $f['place'] ?? null, 'Belum disiapkan'];
                }
            }
        } elseif ($format === 'volume') {
            $doc['columns'] = ['Pekerjaan', 'Lokasi', 'Satuan', 'Volume final', 'Jam dialokasikan', 'Produktivitas / jam'];
            $groups = [];
            foreach ($reports as $r) {
                foreach ($r['activities'] as $a) {
                    $key = ($a['work_code'] ?? $a['description']).'|'.($a['location_uuid'] ?? '').'|'.($a['unit'] ?? '');
                    $groups[$key] ??= ['description' => $a['description'], 'location' => $locations[$a['location_uuid'] ?? '']['name'] ?? null, 'unit' => $a['unit'] ?? null, 'quantity' => '0.000', 'seconds' => 0, 'known' => false];
                    if (isset($a['quantity']) && $a['quantity'] !== '') {
                        $groups[$key]['quantity'] = bcadd($groups[$key]['quantity'], (string) $a['quantity'], 3);
                        $groups[$key]['known'] = true;
                    }$groups[$key]['seconds'] += (int) round($this->activityHours($a) * 3600);
                }
            }
            foreach ($groups as $g) {
                $doc['rows'][] = [$g['description'], $g['location'], $g['unit'], $g['known'] ? (float) $g['quantity'] : null, $g['seconds'] / 3600, $g['seconds'] > 0 && $g['known'] ? (float) bcdiv(bcmul($g['quantity'], '3600', 9), (string) $g['seconds'], 6) : null];
            }
        } elseif ($format === 'plan') {
            $doc['columns'] = ['Rencana', 'Periode awal', 'Periode akhir', 'Pekerjaan', 'Lokasi', 'Target', 'Aktual final', 'Satuan', 'Selisih', 'Pencapaian %'];
            foreach ($dataset['plans'] ?? [] as $plan) {
                if ($plan['ends_on'] < $filter['start_date'] || $plan['starts_on'] > $filter['end_date']) {
                    continue;
                }foreach ($plan['items'] as $item) {
                    $actual = '0.000';
                    foreach ($reports as $r) {
                        foreach ($r['activities'] as $a) {
                            if (($a['plan_item_uuid'] ?? null) === $item['uuid'] && ($a['unit'] ?? null) === $item['unit'] && isset($a['quantity']) && $a['quantity'] !== '') {
                                $actual = bcadd($actual, (string) $a['quantity'], 3);
                            }
                        }
                    }$doc['rows'][] = [$plan['title'], $plan['starts_on'], $plan['ends_on'], $item['description'], $locations[$item['location_uuid']]['name'] ?? null, $n($item['target']), (float) $actual, $item['unit'], (float) bcsub($actual, (string) $item['target'], 3), bccomp((string) $item['target'], '0', 3) > 0 ? (float) bcdiv(bcmul($actual, '100', 6), (string) $item['target'], 6) : null];
                }
            }
        } elseif ($format === 'maintenance') {
            $doc['columns'] = ['Equipment', 'Tipe WO', 'Mulai', 'Status', 'Diagnosis', 'Teknisi', 'Tindakan', 'Hasil', 'Part / jumlah / satuan', 'Rilis'];
            foreach ($dataset['orders'] ?? [] as $o) {
                if (($filter['equipment_uuid'] && $o['equipment_uuid'] !== $filter['equipment_uuid']) || CarbonImmutable::parse($o['starts_at'])->gte(CarbonImmutable::parse($filter['end_date'], $timezone)->addDay()->utc()) || (! empty($o['released_at']) && CarbonImmutable::parse($o['released_at'])->lte(CarbonImmutable::parse($filter['start_date'], $timezone)->utc()))) {
                    continue;
                }foreach ($o['actions'] ?: [[]] as $a) {
                    $doc['rows'][] = [$equipment[$o['equipment_uuid']]['code'] ?? null, $o['type'], $time($o['starts_at']), $o['status'], $o['diagnosis'], $people[$a['technician_uuid'] ?? '']['name'] ?? null, $a['description'] ?? null, $a['result'] ?? null, collect($a['parts'] ?? [])->map(fn ($p) => $p['code'].' '.$p['name'].' / '.$p['quantity'].' '.$p['unit'])->implode('; '), $time($o['released_at'] ?? null)];
                }
            }
        } elseif ($format === 'downtime') {
            $doc['columns'] = ['Equipment', 'Sumber', 'Mulai', 'Akhir', 'Irisan durasi (jam)'];
            $intervals = [];
            $from = CarbonImmutable::parse($filter['start_date'], $timezone)->utc()->getTimestamp();
            $to = CarbonImmutable::parse($filter['end_date'], $timezone)->addDay()->utc()->getTimestamp();
            $cutoff = min($to, now()->getTimestamp());
            foreach (array_merge(array_map(fn ($b) => ['source' => 'Breakdown', 'equipment_uuid' => $b['equipment_uuid'], 'starts_at' => $b['occurred_at'], 'ends_at' => $b['ended_at'] ?? null], $dataset['breakdowns'] ?? []), array_map(fn ($o) => ['source' => 'Maintenance', 'equipment_uuid' => $o['equipment_uuid'], 'starts_at' => $o['starts_at'], 'ends_at' => $o['released_at'] ?? null], $dataset['orders'] ?? [])) as $row) {
                if ($filter['equipment_uuid'] && $row['equipment_uuid'] !== $filter['equipment_uuid']) {
                    continue;
                }$s = CarbonImmutable::parse($row['starts_at'])->getTimestamp();
                $e = $row['ends_at'] ? CarbonImmutable::parse($row['ends_at'])->getTimestamp() : $cutoff;
                $seconds = app(Measurements::class)->unionSeconds([[$s, $e]], $from, $cutoff);
                if ($seconds <= 0) {
                    continue;
                }$intervals[$row['equipment_uuid']][] = [$s, $e];
                $doc['rows'][] = [$equipment[$row['equipment_uuid']]['code'] ?? null, $row['source'], $time($row['starts_at']), $time($row['ends_at']), $seconds / 3600];
            }
            foreach ($intervals as $eq => $ranges) {
                $doc['summary'][] = ($equipment[$eq]['code'] ?? $eq).': '.number_format(app(Measurements::class)->unionSeconds($ranges, $from, $cutoff) / 3600, 3, ',', '.').' jam union downtime';
            }
            $doc['notes'][] = 'Total memakai union interval per alat, diiris periode dan cutoff. Baris sumber tidak dijumlahkan mentah karena dapat bertumpang tindih.';
        } elseif ($format === 'personnel') {
            $doc['columns'] = ['Personel', 'Peran', 'Tanggal', 'Equipment', 'Aktivitas', 'Jam laporan', 'Lembur (menit)'];
            foreach ($reports as $r) {
                $doc['rows'][] = [$operator($r), 'Operator', $r['work_date'], $code($r), collect($r['activities'])->pluck('description')->implode('; '), ($r['work_seconds'] ?? 0) / 3600, $r['overtime_minutes'] ?? 0];
                foreach ($r['helpers'] ?? [] as $h) {
                    $doc['rows'][] = [$people[$h['person_uuid']]['name'] ?? null, 'Helper', $r['work_date'], $code($r), null, null, $h['overtime_minutes'] ?? 0];
                }
            }
        } elseif ($format === 'quality') {
            $doc['columns'] = ['File', 'Sheet', 'Baris', 'Klasifikasi', 'Masalah', 'Status sumber'];
            foreach ($dataset['imports'] ?? [] as $batch) {
                foreach ($batch['rows'] ?? [] as $row) {
                    $doc['rows'][] = [$batch['filename'], $row['sheet'], $row['row_number'], $row['classification'], implode('; ', $row['issues'] ?? []), 'Belum diverifikasi'];
                }
            }
        }
        if (in_array($format, ['vehicle', 'heavy', 'yanmar', 'genset'], true)) {
            $fuelRows = [];
            $overtime = [];
            foreach ($reports as $r) {
                foreach ($r['fuel_events'] as $f) {
                    $fuelRows[] = [$r['work_date'], $code($r), $f['fuel_type'], $label($f['meaning']), $n($f['quantity']), $f['unit'], $label($f['method']), empty($f['verified_at']) ? 'Belum diverifikasi' : 'Terverifikasi', $f['place'] ?? null];
                }$overtime[] = [$r['work_date'], $operator($r), 'Operator', $r['overtime_minutes'] ?? 0];
                foreach ($r['helpers'] ?? [] as $h) {
                    $overtime[] = [$r['work_date'], $people[$h['person_uuid']]['name'] ?? null, 'Helper', $h['overtime_minutes'] ?? 0];
                }
            }
            $doc['sections'][] = ['title' => 'BBM & pelumas · makna per transaksi', 'columns' => ['Tanggal', 'Equipment', 'Jenis', 'Makna', 'Jumlah', 'Satuan', 'Metode', 'Verifikasi', 'Tempat'], 'rows' => $fuelRows];
            $doc['sections'][] = ['title' => 'Lembur personel · bukan payroll', 'columns' => ['Tanggal', 'Nama personel', 'Peran', 'Lembur (menit)'], 'rows' => $overtime];
        }
        if (! in_array($format, ['plan', 'quality', 'downtime', 'maintenance'], true)) {
            foreach (['HM', 'KM', 'H'] as $unit) {
                $values = $reports->where('meter_unit', $unit)->pluck('meter_delta')->filter(fn ($v) => $v !== null);
                if ($values->isNotEmpty()) {
                    $total = $values->reduce(fn ($sum, $v) => bcadd($sum, (string) $v, 3), '0.000');
                    $doc['summary'][] = $unit.': '.number_format((float) $total, 3, ',', '.');
                }
            }if ($reports->isNotEmpty()) {
                $doc['summary'][] = 'Jam kerja waktu: '.number_format($reports->sum('work_seconds') / 3600, 3, ',', '.');
            }
        }

        return $doc;
    }

    private function activityHours(array $activity): float
    {
        return app(Measurements::class)->seconds($activity['starts_at'], $activity['ends_at'], (int) ($activity['break_seconds'] ?? 0)) / 3600;
    }

    private function fuelTotal(array $report, string $meaning): ?string
    {
        $rows = collect($report['fuel_events'])->filter(fn ($f) => $f['meaning'] === $meaning && ! empty($f['verified_at']) && $f['unit'] === 'L');

        return $rows->isEmpty() ? null : $rows->reduce(fn ($sum, $f) => bcadd($sum, (string) $f['quantity'], 3), '0.000');
    }

    public function download(array $document, string $output): Response
    {
        if ($output === 'pdf') {
            $rows = count($document['rows']) + array_sum(array_map(fn ($section) => count($section['rows']), $document['sections']));
            if ($rows > 100) {
                return response(app(PdfTableWriter::class)->render($document), 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="EPITA-laporan.pdf"', 'Cache-Control' => 'private, no-store']);
            }
            $options = new Options;
            $options->set('isRemoteEnabled', false);
            $options->set('isPhpEnabled', false);
            $options->set('defaultFont', 'DejaVu Sans');
            $options->set('chroot', resource_path('views/exports'));
            $pdf = new Dompdf($options);
            $pdf->setPaper('A3', 'landscape');
            $pdf->loadHtml(view('exports.document', ['document' => $document])->render());
            $pdf->render();
            $pdf->getCanvas()->page_text(1070, 808, 'Halaman {PAGE_NUM} / {PAGE_COUNT}', null, 8, [.45, .5, .55]);

            return response($pdf->output(), 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="EPITA-laporan.pdf"', 'Cache-Control' => 'private, no-store']);
        }
        abort_unless($output === 'xlsx', 422);
        $workbook = new Spreadsheet;
        $sheet = $workbook->getActiveSheet();
        $sheet->setTitle('EPITA');
        $last = Coordinate::stringFromColumnIndex(max(count($document['columns']), 4));
        $sheet->mergeCells("A1:{$last}1")->setCellValueExplicit('A1', $document['title'], DataType::TYPE_STRING);
        $sheet->mergeCells("A2:{$last}2")->setCellValueExplicit('A2', $document['subtitle'], DataType::TYPE_STRING);
        $sheet->mergeCells("A3:{$last}3")->setCellValueExplicit('A3', $document['watermark'] ?? $document['source_label'] ?? 'Data sesuai filter', DataType::TYPE_STRING);
        $row = 5;
        $write = function (array $values, bool $header = false) use ($sheet, &$row): void {
            foreach ($values as $i => $value) {
                $cell = Coordinate::stringFromColumnIndex($i + 1).$row;
                if (is_int($value) || is_float($value)) {
                    $sheet->setCellValueExplicit($cell, $value, DataType::TYPE_NUMERIC);
                    $sheet->getStyle($cell)->getNumberFormat()->setFormatCode('#,##0.000');
                } elseif (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                    $sheet->setCellValue($cell, Date::PHPToExcel(CarbonImmutable::parse($value)));
                    $sheet->getStyle($cell)->getNumberFormat()->setFormatCode('dd mmm yyyy');
                } else {
                    $sheet->setCellValueExplicit($cell, $value === null ? '' : (string) $value, DataType::TYPE_STRING);
                }
            }
            $end = Coordinate::stringFromColumnIndex(max(count($values), 1));
            $sheet->getStyle("A{$row}:{$end}{$row}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('E0E8ED');
            $sheet->getStyle("A{$row}:{$end}{$row}")->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_TOP);
            if ($header) {
                $sheet->getStyle("A{$row}:{$end}{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('0A3553');
                $sheet->getStyle("A{$row}:{$end}{$row}")->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
            }$row++;
        };
        $write($document['columns'], true);
        foreach ($document['rows'] as $values) {
            $write($values);
        }if (! $document['rows']) {
            $write(['Tidak ada data pada filter ini.']);
        }$sheet->setAutoFilter('A5:'.$last.max(5, $row - 1));
        $row++;
        foreach ($document['summary'] as $summary) {
            $write([$summary]);
        }$row++;
        foreach ($document['sections'] as $section) {
            $write([$section['title']], true);
            $write($section['columns'], true);
            foreach ($section['rows'] as $values) {
                $write($values);
            }$row += 2;
        }
        $write(['Dibuat oleh', 'Diperiksa oleh', 'Disetujui oleh']);
        $row += 3;
        $write(['Nama / jabatan / tanggal', 'Nama / jabatan / tanggal', 'Nama / jabatan / tanggal']);
        $row++;
        foreach ($document['notes'] as $note) {
            $write([$note]);
        }
        $sheet->getStyle("A1:{$last}{$row}")->getFont()->setName('Calibri')->setSize(10);
        $sheet->getStyle('A1')->getFont()->setSize(17)->setBold(true);
        $sheet->getStyle('A3')->getFont()->getColor()->setRGB('9F7A21');
        foreach (range(1, count($document['columns'])) as $index) {
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($index))->setWidth($index === 1 ? 16 : 23);
        }
        $sheet->freezePane('A6');
        $sheet->getPageSetup()->setOrientation('landscape')->setPaperSize(8)->setFitToWidth(1)->setFitToHeight(0)->setRowsToRepeatAtTopByStartAndEnd(5, 5)->setPrintArea("A1:{$last}{$row}");
        $sheet->getHeaderFooter()->setOddFooter('&LEPITA &C&P / &N &R'.$document['watermark']);
        ob_start();
        (new Xlsx($workbook))->save('php://output');
        $bytes = ob_get_clean();
        $workbook->disconnectWorksheets();

        return response($bytes, 200, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition' => 'attachment; filename="EPITA-laporan.xlsx"', 'Cache-Control' => 'private, no-store']);
    }
}

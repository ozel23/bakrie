<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use ZipArchive;

class WorkbookImporter
{
    public const IW47_COLUMNS = ['Confirmation', 'Counter', 'Equipment', 'Order', 'Description', 'User Status', 'Activity', 'Actual Execution Start Date', 'Actual Execution Start Time', 'Actual Execution End Date', 'Actual Execution End Time', 'Actual work', 'Unit work (actual)', 'Confirmation text', 'Work center (actual)', 'Plant (actual)', 'Cancelled Confirm.', 'Last Change', 'Created On', 'Posting Date', 'Created by', 'Order type', 'Final confirmation', 'Reason for Variance', 'Description of Work', 'System Status', 'Operator/Mechanic Code', 'Operator/Mechanic Name', 'Helper 1 Code', 'Helper 1 Name', 'Helper 2 Code', 'Helper 2 Name', 'Angkut', 'Transportation', 'Quantity', 'Base Unit of Measure'];

    public function inspect(string $path, string $kind): array
    {
        $zip = new ZipArchive;
        if ($zip->open($path) === true) {
            $bytes = 0;
            foreach (range(0, $zip->numFiles - 1) as $i) {
                $bytes += ($zip->statIndex($i)['size'] ?? 0);
            } $zip->close();
            if ($bytes > 100 * 1024 * 1024) {
                throw ValidationException::withMessages(['file' => 'Workbook terlalu besar setelah ekstraksi. Batasi sumber menjadi beberapa file.']);
            }
        }
        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        if (method_exists($reader, 'setReadEmptyCells')) {
            $reader->setReadEmptyCells(false);
        }if (method_exists($reader, 'setIgnoreRowsWithNoCells')) {
            $reader->setIgnoreRowsWithNoCells(true);
        }
        $workbook = $reader->load($path);
        Date::setExcelCalendar($workbook->getExcelCalendar());
        $result = [];
        foreach ($workbook->getWorksheetIterator() as $sheet) {
            $header = null;
            $headerRow = 0;
            $headerValues = [];
            foreach ($sheet->getRowIterator(1, min(35, $sheet->getHighestDataRow())) as $row) {
                $values = [];
                $cells = $row->getCellIterator();
                $cells->setIterateOnlyExistingCells(true);
                foreach ($cells as $cell) {
                    $values[$cell->getColumn()] = $this->raw($cell->getValue());
                }$normalized = array_map(fn ($v) => $this->key((string) $v), $values);
                if ($kind === 'iw47' && in_array('confirmation', $normalized, true) && in_array('equipment', $normalized, true)) {
                    $header = $normalized;
                    $headerValues = $values;
                    $headerRow = $row->getRowIndex();
                    break;
                }
                if ($kind === 'daily' && (in_array('tanggal', $normalized, true) || in_array('tgl', $normalized, true))) {
                    $header = $normalized;
                    $headerValues = $values;
                    $headerRow = $row->getRowIndex();
                    break;
                }
            }
            if (! $header) {
                if ($kind === 'daily') {
                    $result[] = ['sheet' => $sheet->getTitle(), 'row_number' => 1, 'classification' => 'needs_review', 'raw_payload' => [], 'normalized' => [], 'issues' => ['Header detail belum dikenali; perlu mapping sheet (rekap/operator tidak diposting).']];
                }

                continue;
            }
            if ($kind === 'iw47') {
                $missing = array_filter(self::IW47_COLUMNS, fn ($c) => ! in_array($this->key($c), $header, true));
                if ($missing) {
                    throw ValidationException::withMessages(['file' => 'Header IW47 tidak lengkap: '.implode(', ', $missing)]);
                }
            }
            $highest = $sheet->getHighestDataRow();
            if ($highest > 100000) {
                throw ValidationException::withMessages(['file' => 'Rentang data melebihi batas pemeriksaan. Perlu parser streaming khusus; jutaan baris format tidak akan dianggap transaksi.']);
            }
            if ($highest <= $headerRow) {
                continue;
            }
            foreach ($sheet->getRowIterator($headerRow + 1, $highest) as $row) {
                $raw = [];
                $mapped = [];
                $cells = $row->getCellIterator();
                $cells->setIterateOnlyExistingCells(true);
                foreach ($cells as $cell) {
                    $value = $this->raw($cell->getValue());
                    if ($value !== null && $value !== '') {
                        $raw[$cell->getColumn()] = $value;
                        if (isset($header[$cell->getColumn()])) {
                            $mapped[$header[$cell->getColumn()]] = $value;
                        }
                    }
                }if (! $raw) {
                    continue;
                }
                $issues = [];
                $classification = 'detail';
                $normal = [];
                $joined = implode(' ', array_map(fn ($v) => (string) $v, $raw));
                if (preg_match('/\b(sub\s*total|subtotal|total|jumlah)\b/i', $joined)) {
                    $classification = 'subtotal';
                }
                if ($kind === 'iw47') {
                    $confirmation = trim((string) ($mapped['confirmation'] ?? ''));
                    $eq = trim((string) ($mapped['equipment'] ?? ''));
                    $counter = trim((string) ($mapped['counter'] ?? ''));
                    $posting = $this->date($mapped['posting date'] ?? null);
                    $cancel = trim((string) ($mapped['cancelled confirm.'] ?? ''));
                    $normal = ['confirmation' => $confirmation, 'counter' => $counter, 'equipment_code' => $eq, 'posting_date' => $posting, 'actual_work' => $this->numeric($mapped['actual work'] ?? null), 'work_unit' => (string) ($mapped['unit work (actual)'] ?? ''), 'quantity' => $this->numeric($mapped['quantity'] ?? null), 'quantity_unit' => (string) ($mapped['base unit of measure'] ?? ''), 'cancellation_raw' => $cancel];
                    if ($classification !== 'subtotal' && (! $confirmation || ! $eq)) {
                        $classification = 'needs_review';
                        $issues[] = 'Identitas Confirmation / Equipment tidak lengkap; tidak diposting sebagai detail.';
                    }if ($classification === 'detail' && $counter === '') {
                        $issues[] = 'Counter belum tersedia; identitas SAP belum lengkap.';
                    }if (! $posting) {
                        $issues[] = 'Posting Date kosong atau ambigu; perlu pemeriksaan.';
                    }if ($cancel !== '' && preg_match('/^0+(\.0+)?$/', $cancel) !== 1) {
                        $issues[] = 'Cancelled Confirm. perlu penyelesaian semantik SAP; net actual work belum dihitung.';
                    }
                    $preserved = [];
                    foreach ($headerValues as $col => $label) {
                        $preserved[(string) $label] = $raw[$col] ?? null;
                    }$raw = $preserved;
                } else {
                    $normal = ['work_date' => $this->date($mapped['tanggal'] ?? $mapped['tgl'] ?? reset($raw)), 'equipment_code' => (string) ($mapped['equipment'] ?? $mapped['kode alat'] ?? ''), 'fuel_meaning' => 'unverified'];
                    if (! $normal['work_date']) {
                        $classification = 'needs_review';
                        $issues[] = 'Tanggal belum dapat dipetakan.';
                    }if (! $normal['equipment_code']) {
                        $issues[] = 'Equipment belum dipetakan; identitas sheet bukan master final.';
                    }$issues[] = 'Mapping kolom harian dan arti BBM perlu pemeriksaan per laporan; sumber tetap mentah.';
                }
                if (str_starts_with(ltrim($joined), '=')) {
                    $issues[] = 'Formula dipertahankan sebagai teks; tidak dieksekusi.';
                }
                $result[] = ['sheet' => $sheet->getTitle(), 'row_number' => $row->getRowIndex(), 'classification' => $classification, 'raw_payload' => $raw, 'normalized' => $normal, 'issues' => $issues];
                if (count($result) > 20000) {
                    throw ValidationException::withMessages(['file' => 'Maksimal 20.000 baris sumber per batch. Pecah workbook ke batch lebih kecil.']);
                }
            }
        }
        $workbook->disconnectWorksheets();
        if (! $result && $kind === 'iw47') {
            throw ValidationException::withMessages(['file' => 'Tidak ada header IW47 dengan 36 kolom yang dikenali.']);
        }

        return $result;
    }

    private function key(string $value): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $value)));
    }

    private function raw(mixed $value): mixed
    {
        return $value instanceof \Stringable ? (string) $value : $value;
    }

    private function numeric(mixed $value): ?string
    {
        return $value !== null && $value !== '' && is_numeric($value) ? bcadd((string) $value, '0', 3) : null;
    }

    private function date(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }if (is_numeric($value) && $value > 0 && $value < 100000) {
            return Date::excelToDateTimeObject((float) $value)->format('Y-m-d');
        }if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            try {
                return CarbonImmutable::createFromFormat('!Y-m-d', $value)->format('Y-m-d');
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }
}

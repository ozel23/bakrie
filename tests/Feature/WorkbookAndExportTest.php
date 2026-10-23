<?php

namespace Tests\Feature;

use App\Services\ExportService;
use App\Services\WorkbookImporter;
use Illuminate\Support\Facades\File;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class WorkbookAndExportTest extends TestCase
{
    public function test_iw47_preserves_all_columns_codes_dates_and_separates_totals(): void
    {
        $book = new Spreadsheet;
        $s = $book->getActiveSheet();
        $s->fromArray(WorkbookImporter::IW47_COLUMNS, null, 'A1');
        $values = array_fill_keys(WorkbookImporter::IW47_COLUMNS, '');
        $values = array_merge($values, ['Confirmation' => '000010', 'Counter' => '0001', 'Equipment' => '000009', 'Order' => '0000050', 'Activity' => '0010', 'Reason for Variance' => '050', 'Actual work' => 8, 'Unit work (actual)' => 'Hm', 'Quantity' => 3300, 'Base Unit of Measure' => 'M', 'Posting Date' => Date::PHPToExcel(new \DateTimeImmutable('2026-08-01'))]);
        foreach (array_values($values) as $i => $value) {
            $s->getCell([$i + 1, 2])->setValueExplicit($value, is_numeric($value) && ! is_string($value) ? DataType::TYPE_NUMERIC : DataType::TYPE_STRING);
        }$s->setCellValue('E3', 'Subtotal');
        $s->setCellValue('C3', '000009');
        $s->setCellValue('L3', 8);
        $s->getStyle('A1048549')->getFont()->setBold(true);
        $path = tempnam(sys_get_temp_dir(), 'epita-');
        (new Xlsx($book))->save($path);
        try {
            $rows = app(WorkbookImporter::class)->inspect($path, 'iw47');
            $this->assertCount(2, $rows);
            $this->assertSame('detail', $rows[0]['classification']);
            $this->assertSame('subtotal', $rows[1]['classification']);
            $this->assertCount(36, $rows[0]['raw_payload']);
            $this->assertSame('000010', $rows[0]['normalized']['confirmation']);
            $this->assertSame('0010', $rows[0]['raw_payload']['Activity']);
            $this->assertSame('050', $rows[0]['raw_payload']['Reason for Variance']);
            $this->assertSame('2026-08-01', $rows[0]['normalized']['posting_date']);
            $this->assertSame('8.000', $rows[0]['normalized']['actual_work']);
            $this->assertSame('3300.000', $rows[0]['normalized']['quantity']);
        } finally {
            unlink($path);
        }
    }

    public function test_exports_keep_headers_unique_and_prevent_formula_execution(): void
    {
        $dataset = ['equipment' => [['uuid' => 'eq', 'code' => '000001', 'name' => '=HYPERLINK("https://invalid.test")', 'category' => 'vehicle', 'plate' => 'DEMO']], 'people' => [['uuid' => 'op', 'name' => 'Operator sintetis']], 'locations' => [], 'reports' => [['uuid' => 'r', 'equipment_uuid' => 'eq', 'operator_uuid' => 'op', 'work_date' => '2026-10-01', 'shift' => 'utama', 'status' => 'approved', 'meter_start' => '100', 'meter_end' => '120', 'meter_delta' => '20', 'meter_unit' => 'KM', 'work_seconds' => 7200, 'notes' => 'Sumber test', 'activities' => [['starts_at' => '2026-10-01T07:00:00+07:00', 'ends_at' => '2026-10-01T08:00:00+07:00', 'break_seconds' => 0, 'description' => 'Trip 1', 'quantity' => '10', 'unit' => 'KG'], ['starts_at' => '2026-10-01T08:00:00+07:00', 'ends_at' => '2026-10-01T09:00:00+07:00', 'break_seconds' => 0, 'description' => 'Trip 2', 'quantity' => '20', 'unit' => 'PKK']], 'fuel_events' => [], 'helpers' => [], 'overtime_minutes' => 0]], 'plans' => [], 'orders' => [], 'breakdowns' => [], 'imports' => []];
        $service = app(ExportService::class);
        $doc = $service->build($dataset, ['format' => 'vehicle', 'start_date' => '2026-10-01', 'end_date' => '2026-10-31', 'status' => 'approved'], 'Plant pengujian');
        $this->assertCount(2, $doc['rows']);
        $this->assertSame(20.0, $doc['sections'][0]['rows'][0][1]);
        $this->assertNull($doc['rows'][0][6]);
        $this->assertNull($doc['watermark']);
        $response = $service->download($doc, 'xlsx');
        $path = tempnam(sys_get_temp_dir(), 'epita-xlsx-');
        file_put_contents($path, $response->getContent());
        try {
            $sheet = IOFactory::load($path)->getActiveSheet();
            $this->assertSame(DataType::TYPE_STRING, $sheet->getCell('B6')->getDataType());
            $this->assertStringStartsWith('000001', $sheet->getCell('B6')->getValue());
            $this->assertSame('A6', $sheet->getFreezePane());
        } finally {
            unlink($path);
        }$pdf = $service->download($doc, 'pdf');
        $this->assertStringStartsWith('%PDF-', $pdf->getContent());
    }

    public function test_all_four_operational_templates_render_excel_and_pdf_without_synthetic_labels(): void
    {
        $dataset = json_decode(file_get_contents(base_path('tests/Fixtures/export-demo.json')), true, 512, JSON_THROW_ON_ERROR);
        foreach (['vehicle', 'heavy', 'yanmar', 'genset'] as $format) {
            $document = app(ExportService::class)->build($dataset, ['format' => $format, 'start_date' => '2026-10-01', 'end_date' => '2026-10-31', 'status' => 'all'], 'Plant pengujian');
            $this->assertNotEmpty($document['rows']);
            $this->assertSame('BELUM DIVERIFIKASI', $document['watermark']);
            $this->assertStringNotContainsString('DEMO', $document['watermark']);
            $pdf = app(ExportService::class)->download($document, 'pdf')->getContent();
            $xlsx = app(ExportService::class)->download($document, 'xlsx')->getContent();
            $this->assertStringStartsWith('%PDF-', $pdf);
            $this->assertStringStartsWith('PK', $xlsx);
            if ($directory = getenv('EPITA_QA_OUTPUT')) {
                File::ensureDirectoryExists($directory);
                file_put_contents($directory.'/'.$format.'.pdf', $pdf);
                file_put_contents($directory.'/'.$format.'.xlsx', $xlsx);
            }
        }
    }
}

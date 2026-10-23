<?php

namespace App\Jobs;

use App\Models\ImportBatch;
use App\Models\User;
use App\Services\Access;
use App\Services\WorkbookImporter;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class ParseWorkbook implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 300;

    public function __construct(public int $batchId) {}

    public function handle(WorkbookImporter $importer, Access $access): void
    {
        $batch = ImportBatch::findOrFail($this->batchId);
        $user = User::findOrFail($batch->created_by);
        $access->authorize($user, $batch->plant_id, 'import');
        if ($batch->status === 'staged') {
            return;
        }$batch->update(['status' => 'processing']);
        $rows = $importer->inspect(Storage::disk('local')->path($batch->path), $batch->kind);
        DB::transaction(function () use ($batch, $rows, $user, $access): void {
            $batch = ImportBatch::query()->whereKey($batch->id)->lockForUpdate()->firstOrFail();
            $access->authorize($user, $batch->plant_id, 'import');
            if ($batch->status === 'staged') {
                return;
            }$batch->rows()->delete();
            foreach ($rows as $row) {
                $record = $batch->rows()->create($row);
                if ($batch->kind !== 'iw47' || $row['classification'] !== 'detail') {
                    continue;
                }$n = $row['normalized'];
                if (empty($n['confirmation']) || ! isset($n['counter']) || $n['counter'] === '') {
                    continue;
                }$identity = ['plant_id' => $batch->plant_id, 'sap_system' => $batch->sap_system, 'confirmation' => $n['confirmation'], 'counter' => $n['counter']];
                $payload = json_encode($row['raw_payload'], JSON_THROW_ON_ERROR);
                $hash = hash('sha256', $payload);
                $previous = DB::table('sap_confirmations')->where($identity)->orderByDesc('version')->first();
                if ($previous && hash_equals($previous->payload_hash, $hash)) {
                    continue;
                }DB::table('sap_confirmations')->insert([...$identity, 'uuid' => (string) Str::uuid(), 'version' => ($previous->version ?? 0) + 1, 'import_row_id' => $record->id, 'equipment_code' => $n['equipment_code'], 'posting_date' => $n['posting_date'], 'actual_work' => $n['actual_work'], 'work_unit' => $n['work_unit'], 'quantity' => $n['quantity'], 'quantity_unit' => $n['quantity_unit'], 'cancellation_raw' => $n['cancellation_raw'], 'cancellation_status' => 'unresolved', 'payload_hash' => $hash, 'payload' => $payload, 'created_at' => now(), 'updated_at' => now()]);
            }
            $batch->update(['status' => 'staged', 'error' => null]);
        });
    }

    public function failed(?Throwable $exception): void
    {
        ImportBatch::query()->whereKey($this->batchId)->update(['status' => 'failed', 'error' => 'Pemeriksaan sumber gagal. Periksa header, format, ukuran file, dan kewenangan pengunggah.']);
    }
}

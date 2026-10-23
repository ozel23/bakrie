<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\DailyReport;
use App\Models\Equipment;
use App\Models\Location;
use App\Models\Person;
use App\Models\PlanItem;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ReportWorkflow
{
    public function __construct(private Access $access, private Measurements $measurements) {}

    public function save(User $user, array $input, ?DailyReport $report = null, string $source = 'web'): DailyReport
    {
        $data = Validator::make($input, [
            'uuid' => 'nullable|uuid', 'equipment_uuid' => 'required|uuid', 'operator_uuid' => 'required|uuid',
            'work_date' => 'required|date_format:Y-m-d', 'shift' => 'required|string|max:24',
            'version' => 'required|integer|min:0', 'condition' => 'required|in:working,standby,breakdown,maintenance',
            'meter_start' => 'nullable|numeric|min:0', 'meter_end' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:5000', 'exception_reason' => 'nullable|string|max:2000',
            'activities' => 'present|array|max:50', 'activities.*.starts_at' => 'required|date',
            'activities.*.ends_at' => 'required|date', 'activities.*.description' => 'required|string|max:2000',
            'activities.*.break_seconds' => 'required|integer|min:0', 'activities.*.location_uuid' => 'nullable|uuid',
            'activities.*.plan_item_uuid' => 'nullable|uuid', 'activities.*.quantity' => 'nullable|numeric|min:0',
            'activities.*.unit' => 'nullable|string|max:16', 'activities.*.work_code' => 'nullable|string|max:64',
            'activities.*.origin' => 'nullable|string|max:255', 'activities.*.destination' => 'nullable|string|max:255',
            'activities.*.cargo' => 'nullable|string|max:255', 'activities.*.meter_start' => 'nullable|numeric|min:0',
            'activities.*.meter_end' => 'nullable|numeric|min:0', 'activities.*.sap_order' => 'nullable|string|max:64',
            'activities.*.sap_operation' => 'nullable|string|max:64',
            'fuel_events' => 'present|array|max:30', 'fuel_events.*.meaning' => 'required|in:unverified,receipt,consumption',
            'fuel_events.*.quantity' => 'required|numeric|min:0', 'fuel_events.*.fuel_type' => 'required|string|max:32',
            'fuel_events.*.unit' => 'required|in:L,KG', 'fuel_events.*.method' => 'required|in:direct,stock_balance,estimate',
            'fuel_events.*.place' => 'nullable|string|max:255',
            'helpers' => 'sometimes|array|max:4', 'helpers.*.person_uuid' => 'required|uuid',
            'helpers.*.overtime_minutes' => 'required|integer|min:0|max:1440',
            'overtime_minutes' => 'sometimes|integer|min:0|max:1440',
        ])->validate();

        return DB::transaction(function () use ($user, $data, $report, $source): DailyReport {
            $equipment = Equipment::query()->where('uuid', $data['equipment_uuid'])->lockForUpdate()->firstOrFail();
            $this->access->authorize($user, $equipment->plant_id);
            $operator = Person::query()->where('uuid', $data['operator_uuid'])->where('plant_id', $equipment->plant_id)->where('active', true)->whereIn('type', ['operator', 'driver'])->firstOrFail();
            $permissions = $this->access->permissions($user, $equipment->plant_id);
            abort_unless(in_array('report-delegate', $permissions, true) || (in_array('report-own', $permissions, true) && $operator->user_id === $user->id), 403, 'Anda hanya dapat mengisi laporan personel yang menjadi kewenangan Anda.');
            if (! in_array('report-delegate', $permissions, true)) {
                $startOfDay = CarbonImmutable::parse($data['work_date'], $equipment->plant->timezone)->startOfDay()->utc();
                $assigned = Assignment::query()->where('equipment_id', $equipment->id)->where('operator_id', $operator->id)->where('starts_at', '<', $startOfDay->addDay())->where('ends_at', '>', $startOfDay)->where('status', '!=', 'cancelled')->exists();
                abort_unless($assigned, 403, 'Equipment harus terkait penugasan operator pada tanggal ini.');
            }
            abort_unless($equipment->active, 422, 'Equipment tidak aktif.');
            $this->assertOpenPeriod($equipment->plant_id, $data['work_date']);
            if ($report) {
                $report = DailyReport::query()->whereKey($report->id)->lockForUpdate()->firstOrFail();
                $this->authorizeEdit($user, $report);
                $this->assertVersion($report, $data['version']);
                abort_unless($report->equipment_id === $equipment->id, 422, 'Equipment laporan yang sudah dibuat tidak dapat diganti.');
            } else {
                abort_unless($data['version'] === 0, 409, 'Versi pembuatan draft harus nol.');
            }
            $duplicate = DailyReport::query()->where('equipment_id', $equipment->id)->whereDate('work_date', $data['work_date'])->where('shift', $data['shift']);
            if ($report) {
                $duplicate->where('id', '!=', $report->id);
            }
            if ($duplicate->exists()) {
                throw ValidationException::withMessages(['shift' => 'Laporan alat pada tanggal dan shift ini sudah tersedia.']);
            }
            $delta = isset($data['meter_start'],$data['meter_end']) ? $this->measurements->meter((string) $data['meter_start'], (string) $data['meter_end']) : null;
            $values = [
                'plant_id' => $equipment->plant_id, 'equipment_id' => $equipment->id, 'operator_id' => $operator->id,
                'work_date' => $data['work_date'], 'shift' => $data['shift'], 'condition' => $data['condition'],
                'meter_unit' => $equipment->meter_unit, 'meter_start' => isset($data['meter_start']) ? $this->measurements->decimal($data['meter_start']) : null, 'meter_end' => isset($data['meter_end']) ? $this->measurements->decimal($data['meter_end']) : null,
                'meter_delta' => $delta, 'notes' => $data['notes'] ?? null, 'exception_reason' => $data['exception_reason'] ?? null,
                'confirmed_at' => null, 'status' => 'draft', 'version' => $report ? $report->version + 1 : 1,
            ];
            if ($report) {
                $report->update($values);
            } else {
                $report = DailyReport::create($values + ['uuid' => $data['uuid'] ?? (string) Str::uuid(), 'created_by' => $user->id, 'source' => $source]);
            }
            $report->activities()->delete();
            $seconds = 0;
            $previousEnd = null;
            foreach ($data['activities'] as $index => $activity) {
                $start = CarbonImmutable::parse($activity['starts_at'])->utc();
                $end = CarbonImmutable::parse($activity['ends_at'])->utc();
                if ($previousEnd && $start->lessThan($previousEnd)) {
                    throw ValidationException::withMessages(['activities' => 'Sesi harus berurutan dan tidak bertumpang tindih.']);
                }
                $previousEnd = $end;
                $duration = $this->measurements->seconds($start->toIso8601String(), $end->toIso8601String(), $activity['break_seconds']);
                $location = empty($activity['location_uuid']) ? null : Location::query()->where('uuid', $activity['location_uuid'])->where('plant_id', $equipment->plant_id)->firstOrFail();
                $planItem = empty($activity['plan_item_uuid']) ? null : PlanItem::query()->where('uuid', $activity['plan_item_uuid'])->whereHas('plan', fn ($q) => $q->where('plant_id', $equipment->plant_id))->firstOrFail();
                if (isset($activity['quantity']) && empty($activity['unit'])) {
                    throw ValidationException::withMessages(['activities' => 'Volume membutuhkan satuan.']);
                }
                if ($planItem && ($activity['unit'] ?? null) !== $planItem->unit) {
                    throw ValidationException::withMessages(['activities' => 'Satuan realisasi harus sama dengan satuan rencana.']);
                }
                if (isset($activity['meter_start'],$activity['meter_end'])) {
                    $this->measurements->meter((string) $activity['meter_start'], (string) $activity['meter_end']);
                }
                $report->activities()->create([
                    'sequence' => $index + 1, 'starts_at' => $start, 'ends_at' => $end, 'break_seconds' => $activity['break_seconds'], 'work_seconds' => $duration,
                    'location_id' => $location?->id, 'plan_item_id' => $planItem?->id, 'description' => $activity['description'],
                    'quantity' => isset($activity['quantity']) ? $this->measurements->decimal($activity['quantity']) : null,
                    'unit' => $activity['unit'] ?? null, 'work_code' => $activity['work_code'] ?? null, 'origin' => $activity['origin'] ?? null,
                    'destination' => $activity['destination'] ?? null, 'cargo' => $activity['cargo'] ?? null, 'meter_start' => $activity['meter_start'] ?? null,
                    'meter_end' => $activity['meter_end'] ?? null, 'sap_order' => $activity['sap_order'] ?? null, 'sap_operation' => $activity['sap_operation'] ?? null,
                ]);
                $seconds += $duration;
            }
            $report->update(['work_seconds' => $seconds]);
            $report->fuelEvents()->delete();
            foreach ($data['fuel_events'] as $fuel) {
                $report->fuelEvents()->create(['meaning' => $fuel['meaning'], 'quantity' => $this->measurements->decimal($fuel['quantity']), 'fuel_type' => $fuel['fuel_type'], 'unit' => $fuel['unit'], 'method' => $fuel['method'], 'place' => $fuel['place'] ?? null]);
            }
            DB::table('report_people')->where('daily_report_id', $report->id)->delete();
            DB::table('report_people')->insert(['daily_report_id' => $report->id, 'person_id' => $operator->id, 'role' => 'operator', 'overtime_minutes' => $data['overtime_minutes'] ?? 0]);
            $personIds = [$operator->id];
            foreach ($data['helpers'] ?? [] as $helper) {
                $person = Person::query()->where('plant_id', $equipment->plant_id)->where('uuid', $helper['person_uuid'])->where('active', true)->firstOrFail();
                if (in_array($person->id, $personIds, true)) {
                    throw ValidationException::withMessages(['helpers' => 'Personel tidak boleh dicatat dua kali.']);
                }
                $personIds[] = $person->id;
                DB::table('report_people')->insert(['daily_report_id' => $report->id, 'person_id' => $person->id, 'role' => 'helper', 'overtime_minutes' => $helper['overtime_minutes']]);
            }
            $this->recordEvent($user, $report, 'draft', 'draft', 'Simpan draft');

            return $report->fresh(['equipment', 'operator', 'activities.location', 'fuelEvents', 'approvals.actor']);
        });
    }

    public function transition(User $user, DailyReport $report, string $action, array $input): DailyReport
    {
        $data = Validator::make($input, ['version' => 'required|integer|min:1', 'reason' => 'nullable|string|max:2000', 'confirmed' => 'sometimes|boolean'])->validate();

        return DB::transaction(function () use ($user, $report, $action, $data): DailyReport {
            Equipment::query()->whereKey($report->equipment_id)->lockForUpdate()->firstOrFail();
            $report = DailyReport::query()->whereKey($report->id)->lockForUpdate()->firstOrFail();
            $this->access->authorize($user, $report->plant_id);
            $this->assertVersion($report, $data['version']);
            $this->assertOpenPeriod($report->plant_id, $report->work_date->format('Y-m-d'));
            $from = $report->status;
            if ($action === 'submit') {
                $this->authorizeEdit($user, $report);
                if (! ($data['confirmed'] ?? false)) {
                    throw ValidationException::withMessages(['confirmed' => 'Konfirmasi kebenaran laporan sebelum mengirim.']);
                }
                $this->validateSubmission($report);
                $to = 'submitted';
                $report->confirmed_at = now();
            } else {
                $this->access->authorize($user, $report->plant_id, 'approve');
                abort_if($user->id === $report->created_by || $user->id === $report->operator->user_id, 403, 'Pembuat atau operator tidak boleh menyetujui laporannya sendiri.');
                abort_unless(in_array($from, ['submitted', 'reviewed'], true), 409, 'Laporan tidak berada dalam antrean pemeriksaan.');
                $to = match ($action) {
                    'review' => 'reviewed','return' => 'returned','approve' => 'approved',default => abort(422, 'Aksi tidak dikenal.')
                };
                if ($action === 'return' && empty(trim($data['reason'] ?? ''))) {
                    throw ValidationException::withMessages(['reason' => 'Alasan pengembalian wajib diisi.']);
                }
                if ($action === 'approve') {
                    $this->validateSubmission($report);
                    if ($report->fuelEvents()->where(fn ($q) => $q->where('meaning', 'unverified')->orWhereNull('verified_at'))->exists()) {
                        throw ValidationException::withMessages(['fuel_events' => 'Verifikasi makna dan metode seluruh BBM sebelum persetujuan final.']);
                    }
                    $report->approved_at = now();
                    $latest = DailyReport::query()->where('equipment_id', $report->equipment_id)->where('status', 'approved')->max('meter_end');
                    if ($latest === null || bccomp($report->meter_end, (string) $latest, 3) >= 0) {
                        $report->equipment->update(['last_meter' => $report->meter_end]);
                    }
                }
            }
            $report->status = $to;
            $report->version++;
            $report->save();
            $this->recordEvent($user, $report, $from, $to, $data['reason'] ?? null);

            return $report->fresh(['equipment', 'operator', 'activities.location', 'fuelEvents', 'approvals.actor']);
        });
    }

    public function verifyFuel(User $user, DailyReport $report, array $input): DailyReport
    {
        $data = Validator::make($input, ['version' => 'required|integer', 'fuel_uuid' => 'required|uuid', 'meaning' => 'required|in:receipt,consumption', 'method' => 'required|in:direct,stock_balance,estimate', 'reason' => 'required|string|max:2000'])->validate();

        return DB::transaction(function () use ($user, $report, $data): DailyReport {
            $report = DailyReport::query()->whereKey($report->id)->lockForUpdate()->firstOrFail();
            $this->access->authorize($user, $report->plant_id, 'fuel-verify');
            $this->assertVersion($report, $data['version']);
            abort_unless(in_array($report->status, ['submitted', 'reviewed'], true), 409, 'BBM hanya dapat diverifikasi saat pemeriksaan.');
            abort_if($report->created_by === $user->id || $report->operator->user_id === $user->id, 403, 'Verifikasi membutuhkan pemeriksa lain.');
            $fuel = $report->fuelEvents()->where('uuid', $data['fuel_uuid'])->firstOrFail();
            $fuel->update(['meaning' => $data['meaning'], 'method' => $data['method'], 'verified_by' => $user->id, 'verified_at' => now(), 'verification_reason' => $data['reason']]);
            $report->increment('version');
            $this->recordEvent($user, $report, $report->status, $report->status, 'Verifikasi BBM: '.$data['reason']);

            return $report->fresh(['fuelEvents', 'activities']);
        });
    }

    public function authorizeEdit(User $user, DailyReport $report): void
    {
        $this->access->authorize($user, $report->plant_id);
        abort_unless(in_array($report->status, ['draft', 'returned'], true), 409, 'Versi ini terkunci untuk pemeriksaan atau sudah final.');
        $permissions = $this->access->permissions($user, $report->plant_id);
        abort_unless(in_array('report-delegate', $permissions, true) || ($report->created_by === $user->id && $report->operator->user_id === $user->id && in_array('report-own', $permissions, true)), 403);
        $this->assertOpenPeriod($report->plant_id, $report->work_date->format('Y-m-d'));
    }

    private function assertVersion(DailyReport $report, int $version): void
    {
        abort_unless($report->version === $version, 409, 'Versi server berubah. Muat versi terbaru dan bandingkan sebelum menyimpan.');
    }

    private function assertOpenPeriod(int $plantId, string $date): void
    {
        abort_if(DB::table('reporting_periods')->where('plant_id', $plantId)->where('starts_on', '<=', $date)->where('ends_on', '>=', $date)->whereNotNull('closed_at')->exists(), 409, 'Periode pelaporan sudah ditutup.');
    }

    private function validateSubmission(DailyReport $report): void
    {
        if ($report->meter_start === null || $report->meter_end === null) {
            throw ValidationException::withMessages(['meter_end' => 'Meter awal dan akhir wajib lengkap sebelum dikirim.']);
        }
        $this->measurements->meter($report->meter_start, $report->meter_end);
        if ($report->condition === 'working' && ! $report->activities()->exists()) {
            throw ValidationException::withMessages(['activities' => 'Tambahkan sedikitnya satu aktivitas.']);
        }
        if ($report->condition !== 'working' && empty(trim($report->notes ?? ''))) {
            throw ValidationException::withMessages(['notes' => 'Jelaskan alasan alat tidak bekerja.']);
        }
        $start = $report->activities()->min('starts_at');
        $end = $report->activities()->max('ends_at');
        $history = DailyReport::query()->where('equipment_id', $report->equipment_id)->where('status', 'approved')->where('id', '!=', $report->id)->withMin('activities', 'starts_at')->withMax('activities', 'ends_at')->get();
        $previous = $history->filter(fn ($r) => $r->work_date->lt($report->work_date) || ($start && $r->activities_max_ends_at && $r->activities_max_ends_at <= $start))->sortByDesc(fn ($r) => $r->activities_max_ends_at ?? $r->work_date->format('Y-m-d'))->first();
        $next = $history->filter(fn ($r) => $r->work_date->gt($report->work_date) || ($end && $r->activities_min_starts_at && $r->activities_min_starts_at >= $end))->sortBy(fn ($r) => $r->activities_min_starts_at ?? $r->work_date->format('Y-m-d'))->first();
        if (($previous && bccomp($previous->meter_end, $report->meter_start, 3) !== 0) || ($next && bccomp($next->meter_start, $report->meter_end, 3) !== 0)) {
            throw ValidationException::withMessages(['meter_start' => 'Meter tidak tersambung dengan laporan sebelumnya/berikutnya. Perlu pemeriksaan koreksi meter.']);
        }
        foreach ($report->activities as $activity) {
            $collision = DB::table('report_activities')->join('daily_reports', 'daily_reports.id', '=', 'report_activities.daily_report_id')
                ->where('daily_reports.id', '!=', $report->id)->whereIn('daily_reports.status', ['submitted', 'reviewed', 'approved'])
                ->where(fn ($q) => $q->where('daily_reports.equipment_id', $report->equipment_id)->orWhere('daily_reports.operator_id', $report->operator_id))
                ->where('report_activities.starts_at', '<', $activity->ends_at)->where('report_activities.ends_at', '>', $activity->starts_at)->exists();
            if ($collision) {
                throw ValidationException::withMessages(['activities' => 'Interval alat/operator bertabrakan dengan laporan lain.']);
            }
        }
    }

    private function recordEvent(User $user, DailyReport $report, string $from, string $to, ?string $reason): void
    {
        $snapshot = $report->fresh(['activities', 'fuelEvents'])->toArray();
        $report->approvals()->create(['actor_id' => $user->id, 'report_version' => $report->version, 'from_status' => $from, 'to_status' => $to, 'reason' => $reason, 'membership_snapshot' => $this->access->permissions($user, $report->plant_id), 'snapshot' => $snapshot, 'snapshot_hash' => hash('sha256', json_encode($snapshot, JSON_THROW_ON_ERROR)), 'created_at' => now()]);
        DB::table('server_changes')->insert(['plant_id' => $report->plant_id, 'owner_id' => $report->operator->user_id ?? $report->created_by, 'entity_type' => 'daily_report', 'entity_uuid' => $report->uuid, 'deleted' => false, 'payload' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'created_at' => now()]);
    }
}

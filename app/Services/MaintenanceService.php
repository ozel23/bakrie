<?php

namespace App\Services;

use App\Models\Breakdown;
use App\Models\Equipment;
use App\Models\MaintenanceOrder;
use App\Models\Person;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class MaintenanceService
{
    public function __construct(private Access $access) {}

    public function breakdown(User $user, array $input): Breakdown
    {
        $data = Validator::make($input, ['equipment_uuid' => 'required|uuid', 'occurred_at' => 'required|date', 'description' => 'required|string|max:5000', 'severity' => 'required|in:low,medium,high,critical'])->validate();

        return DB::transaction(function () use ($user, $data): Breakdown {
            $equipment = Equipment::query()->where('uuid', $data['equipment_uuid'])->lockForUpdate()->firstOrFail();
            $this->access->authorize($user, $equipment->plant_id, 'breakdown');
            $this->access->equipment($user, $equipment);
            $row = Breakdown::create(['plant_id' => $equipment->plant_id, 'equipment_id' => $equipment->id, 'reported_by' => $user->id, 'occurred_at' => CarbonImmutable::parse($data['occurred_at'])->utc(), 'description' => $data['description'], 'severity' => $data['severity']]);
            $this->downtime($equipment->id, $row->occurred_at, ['breakdown_id' => $row->id]);
            $equipment->update(['condition' => 'breakdown', 'condition_at' => now()]);

            return $row->load('equipment');
        });
    }

    public function order(User $user, array $input): MaintenanceOrder
    {
        $data = Validator::make($input, ['equipment_uuid' => 'required|uuid', 'breakdown_uuid' => 'nullable|uuid', 'type' => 'required|in:corrective,preventive', 'diagnosis' => 'required|string|max:5000', 'starts_at' => 'required|date'])->validate();

        return DB::transaction(function () use ($user, $data): MaintenanceOrder {
            $equipment = Equipment::query()->where('uuid', $data['equipment_uuid'])->lockForUpdate()->firstOrFail();
            $this->access->authorize($user, $equipment->plant_id, 'maintain');
            $breakdown = empty($data['breakdown_uuid']) ? null : Breakdown::query()->where('equipment_id', $equipment->id)->where('uuid', $data['breakdown_uuid'])->where('status', 'open')->firstOrFail();
            abort_if($data['type'] === 'preventive' && $breakdown, 422, 'Perawatan preventive tidak memerlukan breakdown.');
            $order = MaintenanceOrder::create(['plant_id' => $equipment->plant_id, 'equipment_id' => $equipment->id, 'breakdown_id' => $breakdown?->id, 'created_by' => $user->id, 'type' => $data['type'], 'diagnosis' => $data['diagnosis'], 'starts_at' => CarbonImmutable::parse($data['starts_at'])->utc()]);
            $this->downtime($equipment->id, $order->starts_at, ['maintenance_order_id' => $order->id]);
            $equipment->update(['condition' => 'maintenance', 'condition_at' => now()]);

            return $order->load('equipment', 'actions');
        });
    }

    public function action(User $user, MaintenanceOrder $order, array $input): MaintenanceOrder
    {
        $data = Validator::make($input, ['version' => 'required|integer', 'technician_uuid' => 'required|uuid', 'starts_at' => 'required|date', 'ends_at' => 'required|date|after:starts_at', 'description' => 'required|string|max:5000', 'result' => 'required|string|max:5000', 'parts' => 'present|array|max:50', 'parts.*.code' => 'required|string|max:64', 'parts.*.name' => 'required|string|max:255', 'parts.*.quantity' => 'required|numeric|gt:0', 'parts.*.unit' => 'required|string|max:16', 'parts.*.warehouse_reference' => 'nullable|string|max:255'])->validate();

        return DB::transaction(function () use ($user, $order, $data): MaintenanceOrder {
            $order = MaintenanceOrder::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $this->access->authorize($user, $order->plant_id, 'maintain');
            abort_unless($order->version === $data['version'] && $order->status !== 'released', 409, 'WO berubah atau sudah dirilis.');
            $technician = Person::query()->where('plant_id', $order->plant_id)->where('uuid', $data['technician_uuid'])->where('type', 'technician')->where('active', true)->firstOrFail();
            $action = $order->actions()->create(['technician_id' => $technician->id, 'starts_at' => CarbonImmutable::parse($data['starts_at'])->utc(), 'ends_at' => CarbonImmutable::parse($data['ends_at'])->utc(), 'description' => $data['description'], 'result' => $data['result']]);
            foreach ($data['parts'] as $part) {
                DB::table('maintenance_parts')->insert($part + ['uuid' => (string) Str::uuid(), 'maintenance_action_id' => $action->id, 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
            }
            $order->update(['status' => 'in_progress', 'version' => $order->version + 1]);

            return $order->fresh(['actions.technician', 'equipment']);
        });
    }

    public function release(User $user, MaintenanceOrder $order, array $input): MaintenanceOrder
    {
        $data = Validator::make($input, ['version' => 'required|integer', 'functional_test' => 'required|accepted', 'safety_check' => 'required|accepted', 'notes' => 'required|string|max:2000'])->validate();

        return DB::transaction(function () use ($user, $order, $data): MaintenanceOrder {
            $equipment = Equipment::query()->whereKey($order->equipment_id)->lockForUpdate()->firstOrFail();
            $order = MaintenanceOrder::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $this->access->authorize($user, $order->plant_id, 'release');
            abort_unless($order->version === $data['version'] && $order->status !== 'released', 409, 'WO berubah atau sudah dirilis.');
            abort_unless($order->actions()->exists(), 422, 'Catat tindakan dan hasil pemeriksaan sebelum rilis.');
            $order->update(['status' => 'released', 'released_by' => $user->id, 'released_at' => now(), 'release_checklist' => $data, 'version' => $order->version + 1]);
            DB::table('downtime_intervals')->where('maintenance_order_id', $order->id)->whereNull('ends_at')->update(['ends_at' => now(), 'updated_at' => now()]);
            if ($order->breakdown_id && ! MaintenanceOrder::query()->where('breakdown_id', $order->breakdown_id)->where('status', '!=', 'released')->exists()) {
                $order->breakdown->update(['status' => 'closed']);
                DB::table('downtime_intervals')->where('breakdown_id', $order->breakdown_id)->whereNull('ends_at')->update(['ends_at' => now(), 'updated_at' => now()]);
            }
            if (! DB::table('downtime_intervals')->where('equipment_id', $equipment->id)->whereNull('ends_at')->exists()) {
                $equipment->update(['condition' => 'standby', 'condition_at' => now()]);
            }

            return $order->fresh(['equipment', 'actions']);
        });
    }

    private function downtime(int $equipmentId, mixed $start, array $source): void
    {
        DB::table('downtime_intervals')->insert($source + ['uuid' => (string) Str::uuid(), 'equipment_id' => $equipmentId, 'starts_at' => $start, 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
    }
}

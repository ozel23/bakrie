<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\Equipment;
use App\Models\Location;
use App\Models\Person;
use App\Models\PlanItem;
use App\Models\User;
use App\Models\WorkPlan;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class PlanningService
{
    public function __construct(private Access $access) {}

    public function createPlan(User $user, array $input): WorkPlan
    {
        $data = Validator::make($input, ['plant_uuid' => 'required|uuid', 'title' => 'required|string|max:255', 'starts_on' => 'required|date_format:Y-m-d', 'ends_on' => 'required|date_format:Y-m-d|after_or_equal:starts_on', 'items' => 'required|array|min:1|max:50', 'items.*.location_uuid' => 'required|uuid', 'items.*.work_code' => 'required|string|max:64', 'items.*.description' => 'required|string|max:255', 'items.*.target' => 'required|numeric|gt:0', 'items.*.unit' => 'required|in:'.implode(',', config('epita.units')), 'notes' => 'nullable|string|max:2000'])->validate();
        $plant = $this->access->plant($user, $data['plant_uuid'], 'plan');

        return DB::transaction(function () use ($user, $data, $plant): WorkPlan {
            $plan = WorkPlan::create(['plant_id' => $plant->id, 'created_by' => $user->id, 'title' => $data['title'], 'starts_on' => $data['starts_on'], 'ends_on' => $data['ends_on'], 'notes' => $data['notes'] ?? null]);
            foreach ($data['items'] as $item) {
                $location = Location::query()->where('plant_id', $plant->id)->where('uuid', $item['location_uuid'])->where('active', true)->firstOrFail();
                $plan->items()->create(['location_id' => $location->id, 'work_code' => $item['work_code'], 'description' => $item['description'], 'target' => app(Measurements::class)->decimal($item['target']), 'unit' => $item['unit']]);
            }

            return $plan->load('items.location');
        });
    }

    public function assign(User $user, array $input): Assignment
    {
        $data = Validator::make($input, ['equipment_uuid' => 'required|uuid', 'operator_uuid' => 'required|uuid', 'plan_item_uuid' => 'nullable|uuid', 'starts_at' => 'required|date', 'ends_at' => 'required|date|after:starts_at', 'reason' => 'nullable|string|max:2000'])->validate();

        return DB::transaction(function () use ($user, $data): Assignment {
            $equipment = Equipment::query()->where('uuid', $data['equipment_uuid'])->lockForUpdate()->firstOrFail();
            $this->access->authorize($user, $equipment->plant_id, 'plan');
            abort_unless($equipment->active, 422, 'Equipment tidak aktif.');
            $operator = Person::query()->where('plant_id', $equipment->plant_id)->where('uuid', $data['operator_uuid'])->where('active', true)->whereIn('type', ['operator', 'driver'])->lockForUpdate()->firstOrFail();
            $start = CarbonImmutable::parse($data['starts_at'])->utc();
            $end = CarbonImmutable::parse($data['ends_at'])->utc();
            $collision = Assignment::query()->whereNotIn('status', ['cancelled', 'completed'])->where(fn ($q) => $q->where('equipment_id', $equipment->id)->orWhere('operator_id', $operator->id))->where('starts_at', '<', $end)->where('ends_at', '>', $start)->exists();
            $unavailable = DB::table('downtime_intervals')->where('equipment_id', $equipment->id)->where('starts_at', '<', $end)->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', $start))->exists();
            if ($collision || $unavailable) {
                throw ValidationException::withMessages(['starts_at' => $unavailable ? 'Alat tidak tersedia pada periode ini karena kerusakan/perawatan.' : 'Jadwal alat atau operator bertabrakan.']);
            }
            $item = empty($data['plan_item_uuid']) ? null : PlanItem::query()->where('uuid', $data['plan_item_uuid'])->whereHas('plan', fn ($q) => $q->where('plant_id', $equipment->plant_id))->firstOrFail();
            if ($item) {
                $planStart = CarbonImmutable::parse($item->plan->starts_on, $equipment->plant->timezone)->startOfDay()->utc();
                $planEnd = CarbonImmutable::parse($item->plan->ends_on, $equipment->plant->timezone)->addDay()->startOfDay()->utc();
                if ($start->lt($planStart) || $end->gt($planEnd)) {
                    throw ValidationException::withMessages(['starts_at' => 'Jadwal penugasan harus berada dalam periode rencana.']);
                }
            }
            if (! $item && empty(trim($data['reason'] ?? ''))) {
                throw ValidationException::withMessages(['reason' => 'Penugasan ad hoc membutuhkan alasan.']);
            }

            return Assignment::create(['plant_id' => $equipment->plant_id, 'equipment_id' => $equipment->id, 'operator_id' => $operator->id, 'plan_item_id' => $item?->id, 'created_by' => $user->id, 'starts_at' => $start, 'ends_at' => $end, 'reason' => $data['reason'] ?? null])->load('equipment', 'operator', 'planItem');
        });
    }
}

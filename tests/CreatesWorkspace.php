<?php

namespace Tests;

use App\Models\Equipment;
use App\Models\Membership;
use App\Models\Person;
use App\Models\Plant;
use App\Models\User;
use Illuminate\Support\Str;

trait CreatesWorkspace
{
    protected function world(): array
    {
        $plant = Plant::factory()->create();
        $creator = User::factory()->create();
        $reviewer = User::factory()->create();
        Membership::factory()->create(['user_id' => $creator->id, 'plant_id' => $plant->id, 'role' => 'clerk']);
        Membership::factory()->create(['user_id' => $reviewer->id, 'plant_id' => $plant->id, 'role' => 'supervisor']);
        $equipment = Equipment::factory()->create(['plant_id' => $plant->id]);
        $operator = Person::factory()->create(['plant_id' => $plant->id, 'user_id' => $creator->id]);

        return compact('plant', 'creator', 'reviewer', 'equipment', 'operator');
    }

    protected function reportInput(array $world): array
    {
        return ['uuid' => (string) Str::uuid(), 'equipment_uuid' => $world['equipment']->uuid, 'operator_uuid' => $world['operator']->uuid, 'work_date' => '2026-10-01', 'shift' => 'utama', 'version' => 0, 'condition' => 'working', 'meter_start' => '10023.000', 'meter_end' => '10030.000', 'notes' => 'Sumber sintetis test; bukan transaksi perusahaan', 'activities' => [['starts_at' => '2026-10-01T23:00:00+07:00', 'ends_at' => '2026-10-02T01:00:00+07:00', 'break_seconds' => 0, 'description' => 'Pekerjaan sintetis', 'quantity' => '110', 'unit' => 'M']], 'fuel_events' => [['meaning' => 'unverified', 'quantity' => '20', 'unit' => 'L', 'fuel_type' => 'Solar', 'method' => 'direct']]];
    }
}

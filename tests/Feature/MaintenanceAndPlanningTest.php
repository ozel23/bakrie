<?php

namespace Tests\Feature;

use App\Models\Membership;
use App\Models\Person;
use App\Services\MaintenanceService;
use App\Services\PlanningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesWorkspace;
use Tests\TestCase;

class MaintenanceAndPlanningTest extends TestCase
{
    use CreatesWorkspace, RefreshDatabase;

    public function test_assignment_conflicts_and_breakdown_unavailability_are_rejected(): void
    {
        $w = $this->world();
        $input = ['equipment_uuid' => $w['equipment']->uuid, 'operator_uuid' => $w['operator']->uuid, 'starts_at' => '2026-10-01T07:00:00+07:00', 'ends_at' => '2026-10-01T12:00:00+07:00', 'reason' => 'Tugas ad hoc sintetis'];
        app(PlanningService::class)->assign($w['reviewer'], $input);
        $this->actingAs($w['reviewer'])->postJson('/workspace/actions/assignment.create', [...$input, 'plant_uuid' => $w['plant']->uuid])->assertUnprocessable();
        app(MaintenanceService::class)->breakdown($w['reviewer'], ['equipment_uuid' => $w['equipment']->uuid, 'occurred_at' => '2026-10-01T13:00:00+07:00', 'description' => 'Kerusakan sintetis', 'severity' => 'high']);
        $this->actingAs($w['reviewer'])->postJson('/workspace/actions/assignment.create', [...$input, 'plant_uuid' => $w['plant']->uuid, 'starts_at' => '2026-10-01T14:00:00+07:00', 'ends_at' => '2026-10-01T16:00:00+07:00'])->assertUnprocessable();
    }

    public function test_preventive_release_preserves_other_open_blockers(): void
    {
        $w = $this->world();
        Membership::factory()->create(['user_id' => $w['reviewer']->id, 'plant_id' => $w['plant']->id, 'role' => 'maintenance']);
        $technician = Person::factory()->create(['plant_id' => $w['plant']->id, 'type' => 'technician']);
        $m = app(MaintenanceService::class);
        $breakdown = $m->breakdown($w['reviewer'], ['equipment_uuid' => $w['equipment']->uuid, 'occurred_at' => now()->subHours(2)->toIso8601String(), 'description' => 'Kerusakan lain masih terbuka', 'severity' => 'medium']);
        $order = $m->order($w['reviewer'], ['equipment_uuid' => $w['equipment']->uuid, 'type' => 'preventive', 'diagnosis' => 'Perawatan berkala sintetis', 'starts_at' => now()->subHour()->toIso8601String()]);
        $this->assertNull($order->breakdown_id);
        $order = $m->action($w['reviewer'], $order, ['version' => 1, 'technician_uuid' => $technician->uuid, 'starts_at' => now()->subHour()->toIso8601String(), 'ends_at' => now()->toIso8601String(), 'description' => 'Ganti filter', 'result' => 'Uji lulus', 'parts' => [['code' => '000012', 'name' => 'Filter sintetis', 'quantity' => '1.500', 'unit' => 'PCS']]]);
        $order = $m->release($w['reviewer'], $order, ['version' => $order->version, 'functional_test' => true, 'safety_check' => true, 'notes' => 'Pemeriksaan akhir sintetis']);
        $this->assertSame('released', $order->status);
        $this->assertNotSame('standby', $w['equipment']->fresh()->condition);
        $this->assertSame('open', $breakdown->fresh()->status);
        $this->assertDatabaseHas('maintenance_parts', ['code' => '000012']);
    }
}

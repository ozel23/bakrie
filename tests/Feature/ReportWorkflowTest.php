<?php

namespace Tests\Feature;

use App\Models\Membership;
use App\Services\ReportWorkflow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\CreatesWorkspace;
use Tests\TestCase;

class ReportWorkflowTest extends TestCase
{
    use CreatesWorkspace, RefreshDatabase;

    public function test_report_fuel_verification_and_approval_preserve_history(): void
    {
        $w = $this->world();
        $service = app(ReportWorkflow::class);
        $r = $service->save($w['creator'], $this->reportInput($w));
        $this->assertSame('7.000', $r->meter_delta);
        $this->assertSame(7200, $r->work_seconds);
        $r = $service->transition($w['creator'], $r, 'submit', ['version' => $r->version, 'confirmed' => true]);
        $this->actingAs($w['reviewer'])->postJson('/api/v1/daily-reports/'.$r->uuid.'/approve', ['version' => $r->version])->assertUnprocessable()->assertJsonValidationErrors('fuel_events');
        $r = $service->verifyFuel($w['reviewer'], $r, ['version' => $r->version, 'fuel_uuid' => $r->fuelEvents->first()->uuid, 'meaning' => 'receipt', 'method' => 'direct', 'reason' => 'Konfirmasi pengisian pada bukti sintetis']);
        $r = $service->transition($w['reviewer'], $r, 'approve', ['version' => $r->version]);
        $this->assertSame('approved', $r->status);
        $this->assertSame('receipt', $r->fuelEvents->first()->meaning);
        $this->assertCount(4, $r->approvals);
        $this->assertDatabaseCount('daily_reports', 1);
        $this->assertDatabaseHas('equipment', ['id' => $w['equipment']->id, 'last_meter' => '10030.000']);
        $this->actingAs($w['creator'])->patchJson('/api/v1/daily-reports/'.$r->uuid, [...$this->reportInput($w), 'version' => $r->version])->assertConflict();
    }

    public function test_self_approval_is_denied_even_with_approver_role(): void
    {
        $w = $this->world();
        Membership::factory()->create(['user_id' => $w['creator']->id, 'plant_id' => $w['plant']->id, 'role' => 'supervisor']);
        $r = app(ReportWorkflow::class)->save($w['creator'], $this->reportInput($w));
        $r = app(ReportWorkflow::class)->transition($w['creator'], $r, 'submit', ['version' => 1, 'confirmed' => true]);
        $this->actingAs($w['creator'])->postJson('/api/v1/daily-reports/'.$r->uuid.'/approve', ['version' => $r->version])->assertForbidden();
    }

    public function test_return_revision_and_version_conflict_do_not_erase_history(): void
    {
        $w = $this->world();
        $service = app(ReportWorkflow::class);
        $input = $this->reportInput($w);
        $r = $service->save($w['creator'], $input);
        $r = $service->transition($w['creator'], $r, 'submit', ['version' => 1, 'confirmed' => true]);
        $r = $service->transition($w['reviewer'], $r, 'return', ['version' => 2, 'reason' => 'Perbaiki uraian']);
        $this->assertSame('returned', $r->status);
        $this->actingAs($w['creator'])->patchJson('/api/v1/daily-reports/'.$r->uuid, [...$input, 'version' => 1])->assertConflict();
        $r = $service->save($w['creator'], [...$input, 'version' => 3, 'notes' => 'Revisi tercatat'], $r);
        $this->assertSame(4, $r->version);
        $this->assertCount(4, $r->approvals);
    }

    public function test_invalid_meter_and_closed_period_are_rejected(): void
    {
        $w = $this->world();
        $this->actingAs($w['creator'])->postJson('/api/v1/daily-reports', [...$this->reportInput($w), 'meter_end' => '10022'])->assertUnprocessable();
        $this->assertDatabaseCount('daily_reports', 0);
        DB::table('reporting_periods')->insert(['uuid' => (string) Str::uuid(), 'plant_id' => $w['plant']->id, 'starts_on' => '2026-10-01', 'ends_on' => '2026-10-31', 'closed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        $this->actingAs($w['creator'])->postJson('/api/v1/daily-reports', $this->reportInput($w))->assertConflict();
    }

    public function test_approving_an_earlier_shift_later_does_not_regress_equipment_meter(): void
    {
        $world = $this->world();
        $service = app(ReportWorkflow::class);
        $base = $this->reportInput($world);
        $early = [...$base, 'shift' => 'pagi', 'meter_start' => '100', 'meter_end' => '110', 'fuel_events' => [], 'activities' => [[...$base['activities'][0], 'starts_at' => '2026-10-01T07:00:00+07:00', 'ends_at' => '2026-10-01T08:00:00+07:00']]];
        $late = [...$base, 'uuid' => (string) Str::uuid(), 'shift' => 'sore', 'meter_start' => '110', 'meter_end' => '120', 'fuel_events' => [], 'activities' => [[...$base['activities'][0], 'starts_at' => '2026-10-01T09:00:00+07:00', 'ends_at' => '2026-10-01T10:00:00+07:00']]];
        $later = $service->save($world['creator'], $late);
        $later = $service->transition($world['creator'], $later, 'submit', ['version' => 1, 'confirmed' => true]);
        $service->transition($world['reviewer'], $later, 'approve', ['version' => 2]);
        $earlier = $service->save($world['creator'], $early);
        $earlier = $service->transition($world['creator'], $earlier, 'submit', ['version' => 1, 'confirmed' => true]);
        $service->transition($world['reviewer'], $earlier, 'approve', ['version' => 2]);
        $this->assertDatabaseHas('equipment', ['id' => $world['equipment']->id, 'last_meter' => '120.000']);
        $invalid = [...$early, 'uuid' => (string) Str::uuid(), 'shift' => 'sebelum-pagi', 'meter_start' => '85', 'meter_end' => '95', 'activities' => [[...$base['activities'][0], 'starts_at' => '2026-10-01T05:00:00+07:00', 'ends_at' => '2026-10-01T06:00:00+07:00']]];
        $invalid = $service->save($world['creator'], $invalid);
        $this->actingAs($world['creator'])->postJson('/api/v1/daily-reports/'.$invalid->uuid.'/submit', ['version' => 1, 'confirmed' => true])->assertUnprocessable()->assertJsonValidationErrors('meter_start');
    }
}

<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ReportWorkflow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\CreatesWorkspace;
use Tests\TestCase;

class AccessAndSyncTest extends TestCase
{
    use CreatesWorkspace, RefreshDatabase;

    public function test_cross_plant_and_inactive_access_are_denied(): void
    {
        $w = $this->world();
        $r = app(ReportWorkflow::class)->save($w['creator'], $this->reportInput($w));
        $outsider = User::factory()->create();
        $this->actingAs($outsider)->getJson('/api/v1/daily-reports/'.$r->uuid)->assertForbidden();
        $this->actingAs($outsider)->postJson('/workspace/actions/report.approve', ['uuid' => $r->uuid, 'plant_uuid' => $w['plant']->uuid, 'version' => 1])->assertForbidden();
        $w['creator']->forceFill(['active' => false])->save();
        $this->actingAs($w['creator'])->getJson('/api/v1/me')->assertForbidden();
    }

    public function test_sync_replay_returns_same_receipt_and_changed_payload_is_conflict(): void
    {
        $w = $this->world();
        $input = $this->reportInput($w);
        $device = (string) Str::uuid();
        $operation = ['operation_id' => (string) Str::uuid(), 'entity_id' => $input['uuid'], 'entity_type' => 'daily_report', 'action' => 'create_draft', 'base_version' => 0, 'payload' => $input];
        $batch = ['device_id' => $device, 'operations' => [$operation]];
        $first = $this->actingAs($w['creator'])->postJson('/api/v1/sync/push', $batch)->assertOk()->json();
        $again = $this->postJson('/api/v1/sync/push', $batch)->assertOk()->json();
        $this->assertSame($first, $again);
        $this->assertDatabaseCount('daily_reports', 1);
        $this->assertDatabaseCount('fuel_events', 1);
        $this->assertDatabaseCount('approval_events', 1);
        $this->assertDatabaseCount('sync_receipts', 1);
        $batch['operations'][0]['payload']['notes'] = 'Payload berbeda';
        $this->postJson('/api/v1/sync/push', $batch)->assertConflict();
    }

    public function test_failed_sync_rolls_back_receipt_and_changes_atomically(): void
    {
        $w = $this->world();
        $input = [...$this->reportInput($w), 'meter_end' => '1'];
        $this->actingAs($w['creator'])->postJson('/api/v1/sync/push', ['device_id' => (string) Str::uuid(), 'operations' => [['operation_id' => (string) Str::uuid(), 'entity_id' => $input['uuid'], 'entity_type' => 'daily_report', 'action' => 'create_draft', 'base_version' => 0, 'payload' => $input]]])->assertUnprocessable();
        $this->assertDatabaseCount('daily_reports', 0);
        $this->assertDatabaseCount('sync_receipts', 0);
    }

    public function test_login_regenerates_session_and_has_no_public_signup(): void
    {
        $w = $this->world();
        $w['creator']->update(['password' => 'test-password-123']);
        $this->post('/login', ['email' => $w['creator']->email, 'password' => 'test-password-123'])->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($w['creator']);
        $this->get('/register')->assertNotFound();
    }
}

<?php

namespace Tests\Feature;

use App\Models\DailyReport;
use App\Models\Equipment;
use App\Models\MaintenanceOrder;
use App\Models\Membership;
use App\Models\Person;
use App\Models\WorkPlan;
use App\Services\ExportService;
use App\Services\ReportWorkflow;
use App\Services\WorkspaceData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\CreatesWorkspace;
use Tests\TestCase;

class WorkspaceQueryTest extends TestCase
{
    use CreatesWorkspace, RefreshDatabase;

    public function test_period_totals_and_exports_include_more_than_old_snapshot_limits_and_screen_is_paginated(): void
    {
        $world = $this->world();
        $now = now();
        $reports = [];
        for ($index = 0; $index < 505; $index++) {
            $reports[] = ['uuid' => (string) Str::uuid(), 'plant_id' => $world['plant']->id, 'equipment_id' => $world['equipment']->id, 'operator_id' => $world['operator']->id, 'created_by' => $world['creator']->id, 'work_date' => '2026-10-01', 'shift' => 'shift-'.$index, 'status' => 'approved', 'condition' => 'working', 'meter_unit' => 'HM', 'meter_start' => $index, 'meter_end' => $index + 1, 'meter_delta' => 1, 'work_seconds' => 3600, 'version' => 1, 'created_at' => $now, 'updated_at' => $now];
        }
        foreach (array_chunk($reports, 75) as $chunk) {
            DailyReport::query()->insert($chunk);
        }
        $plans = [];
        $orders = [];
        for ($index = 0; $index < 205; $index++) {
            if ($index < 105) {
                $plans[] = ['uuid' => (string) Str::uuid(), 'plant_id' => $world['plant']->id, 'created_by' => $world['creator']->id, 'title' => 'Rencana '.$index, 'starts_on' => '2026-10-01', 'ends_on' => '2026-10-31', 'status' => 'draft', 'version' => 1, 'created_at' => $now, 'updated_at' => $now];
            }
            $orders[] = ['uuid' => (string) Str::uuid(), 'plant_id' => $world['plant']->id, 'equipment_id' => $world['equipment']->id, 'created_by' => $world['creator']->id, 'type' => 'preventive', 'diagnosis' => 'Pemeriksaan '.$index, 'starts_at' => '2026-10-01 00:00:00', 'status' => 'open', 'version' => 1, 'created_at' => $now, 'updated_at' => $now];
        }
        foreach (array_chunk($plans, 75) as $chunk) {
            WorkPlan::query()->insert($chunk);
        }
        foreach (array_chunk($orders, 75) as $chunk) {
            MaintenanceOrder::query()->insert($chunk);
        }
        $service = app(WorkspaceData::class);
        $screen = $service->screen($world['reviewer'], $world['plant'], 'reports', ['period' => '2026-10', 'reports_page' => 2]);
        $this->assertCount(8, $screen['reports']);
        $this->assertSame(505, $screen['pagination']['reports']['total']);
        $this->assertEquals(505, $screen['metrics']['meter']['HM']);
        $planning = $service->screen($world['reviewer'], $world['plant'], 'planning', ['period' => '2026-10']);
        $this->assertSame(105, $planning['pagination']['plans']['total']);
        $maintenance = $service->screen($world['reviewer'], $world['plant'], 'maintenance', ['period' => '2026-10']);
        $this->assertCount(8, $maintenance['orders']);
        $this->assertSame(205, $maintenance['pagination']['orders']['total']);
        $filters = ['format' => 'meter', 'start_date' => '2026-10-01', 'end_date' => '2026-10-31', 'status' => 'approved'];
        $dataset = $service->documentData($world['reviewer'], $world['plant'], $filters);
        $this->assertCount(505, $dataset['reports']);
        $this->assertCount(105, $service->documentData($world['reviewer'], $world['plant'], [...$filters, 'format' => 'plan'])['plans']);
        $this->assertCount(205, $service->documentData($world['reviewer'], $world['plant'], [...$filters, 'format' => 'maintenance'])['orders']);
        $document = app(ExportService::class)->build($dataset, $filters, $world['plant']->name);
        $this->assertCount(505, $document['rows']);
        $this->assertContains('HM: 505,000', $document['summary']);
        $largePdf = app(ExportService::class)->download($document, 'pdf')->getContent();
        $this->assertStringStartsWith('%PDF-', $largePdf);
        if ($directory = getenv('EPITA_QA_OUTPUT')) {
            File::ensureDirectoryExists($directory);
            file_put_contents($directory.'/meter-large.pdf', $largePdf);
        }
        $this->actingAs($world['reviewer'])->postJson('/workspace/report-preview', [...$filters, 'plant_uuid' => $world['plant']->uuid])->assertOk()->assertJsonCount(100, 'rows')->assertJsonPath('total_rows', 505);
        $this->actingAs($world['reviewer'])->get('/app/reports?period=2026-10&reports_page=2')->assertOk()->assertInertia(fn (Assert $page) => $page->has('snapshot.reports', 8)->where('snapshot.pagination.reports.total', 505));
    }

    public function test_search_period_scope_and_server_export_ignore_client_dataset(): void
    {
        $world = $this->world();
        $workflow = app(ReportWorkflow::class);
        $report = $workflow->save($world['creator'], $this->reportInput($world));
        $report->forceFill(['status' => 'approved'])->save();
        $filters = ['format' => 'meter', 'start_date' => '2026-10-01', 'end_date' => '2026-10-31', 'status' => 'approved', 'plant_uuid' => $world['plant']->uuid, 'dataset' => ['reports' => []]];
        $this->actingAs($world['reviewer'])->postJson('/workspace/report-preview', $filters)->assertOk()->assertJsonCount(1, 'rows')->assertJsonPath('rows.0.1', $world['equipment']->code)->assertJsonPath('watermark', null);
        $this->get('/app/reports?period=2026-10&q=not-found')->assertOk()->assertInertia(fn (Assert $page) => $page->has('snapshot.reports', 0)->where('snapshot.pagination.reports.total', 0));
        $this->getJson('/api/v1/daily-reports?period=2026-11')->assertOk()->assertJsonPath('total', 0);
        $this->get('/app/reports?period=2026-11')->assertOk()->assertInertia(fn (Assert $page) => $page->has('snapshot.reports', 0));
        $other = $this->world();
        $this->postJson('/workspace/report-preview', [...$filters, 'plant_uuid' => $other['plant']->uuid])->assertNotFound();
    }

    public function test_operator_scope_keeps_other_personnel_reports_and_equipment_out_of_web_and_api(): void
    {
        $world = $this->world();
        $input = $this->reportInput($world);
        app(ReportWorkflow::class)->save($world['creator'], $input);
        $equipment = Equipment::factory()->create(['plant_id' => $world['plant']->id]);
        $person = Person::factory()->create(['plant_id' => $world['plant']->id]);
        app(ReportWorkflow::class)->save($world['creator'], [...$input, 'uuid' => (string) Str::uuid(), 'equipment_uuid' => $equipment->uuid, 'operator_uuid' => $person->uuid]);
        Membership::query()->where('user_id', $world['creator']->id)->update(['role' => 'operator']);
        $this->actingAs($world['creator'])->get('/app/reports?period=2026-10')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('snapshot.reports', 1)->has('snapshot.equipment', 1)->where('snapshot.reports.0.operator_uuid', $world['operator']->uuid));
        $this->getJson('/api/v1/equipment/'.$equipment->uuid)->assertForbidden();
        $this->postJson('/workspace/report-preview', ['plant_uuid' => $world['plant']->uuid])->assertForbidden();
    }
}

<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ReportWorkflow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\CreatesWorkspace;
use Tests\TestCase;

class AttachmentAccessTest extends TestCase
{
    use CreatesWorkspace, RefreshDatabase;

    public function test_private_evidence_is_idempotent_scoped_and_rejects_changed_bytes(): void
    {
        Storage::fake('local');
        $world = $this->world();
        $report = app(ReportWorkflow::class)->save($world['creator'], $this->reportInput($world));
        $uuid = (string) Str::uuid();
        $file = UploadedFile::fake()->image('evidence.png');
        $input = ['report_uuid' => $report->uuid, 'attachment_uuid' => $uuid, 'file' => $file];
        $this->actingAs($world['creator'])->post('/workspace/attachments', $input, ['Accept' => 'application/json'])->assertCreated();
        $this->post('/workspace/attachments', $input, ['Accept' => 'application/json'])->assertOk();
        $this->assertDatabaseCount('attachments', 1);
        $this->post('/workspace/attachments', [...$input, 'file' => UploadedFile::fake()->image('different.png', 20, 20)], ['Accept' => 'application/json'])->assertConflict();
        $this->get('/attachments/'.$uuid)->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->actingAs(User::factory()->create())->get('/attachments/'.$uuid)->assertForbidden();
    }
}

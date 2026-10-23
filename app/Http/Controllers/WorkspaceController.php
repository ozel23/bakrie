<?php

namespace App\Http\Controllers;

use App\Http\Requests\WorkspaceFilterRequest;
use App\Jobs\ParseWorkbook;
use App\Models\DailyReport;
use App\Models\Equipment;
use App\Models\ImportBatch;
use App\Models\Location;
use App\Models\MaintenanceOrder;
use App\Models\Person;
use App\Models\Plant;
use App\Services\Access;
use App\Services\ExportService;
use App\Services\MaintenanceService;
use App\Services\PlanningService;
use App\Services\ReportWorkflow;
use App\Services\WorkbookImporter;
use App\Services\WorkspaceData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WorkspaceController extends Controller
{
    private const PAGES = ['dashboard', 'equipment', 'people', 'locations', 'planning', 'reports', 'approvals', 'fuel', 'maintenance', 'exports', 'integrations'];

    public function __construct(private Access $access, private WorkspaceData $workspace) {}

    public function index(WorkspaceFilterRequest $request, string $page = 'dashboard'): Response
    {
        abort_unless(in_array($page, self::PAGES, true), 404);
        $plant = $this->access->plant($request->user(), $request->query('plant'));
        $permission = ['approvals' => 'approve', 'exports' => 'export', 'integrations' => 'import'][$page] ?? 'read';
        $this->access->authorize($request->user(), $plant->id, $permission);

        $filters = array_filter($request->validated(), fn ($value) => $value !== null);
        $filters['period'] ??= now($plant->timezone)->format('Y-m');
        $roles = $request->user()->memberships()->where('plant_id', $plant->id)->where('active', true)->pluck('role')->map(fn ($role) => config('epita.roles.'.$role, $role))->implode(', ');
        $personUuid = Person::query()->where('plant_id', $plant->id)->where('user_id', $request->user()->id)->value('uuid');

        return Inertia::render('Workspace', ['page' => $page, 'filters' => $filters, 'auth' => [...$request->user()->only('name', 'email'), 'role_label' => $roles, 'person_uuid' => $personUuid], 'plant' => $plant, 'plants' => Plant::query()->whereIn('id', $this->access->plantIds($request->user()))->get(), 'permissions' => $this->access->permissions($request->user(), $plant->id), 'snapshot' => $this->workspace->screen($request->user(), $plant, $page, $filters)]);
    }

    public function action(Request $request, string $action): JsonResponse
    {
        $user = $request->user();
        $input = $request->all();
        $plant = $this->access->plant($user, $request->input('plant_uuid'));
        $report = fn () => DailyReport::query()->where('plant_id', $plant->id)->where('uuid', $request->input('uuid', $request->input('report_uuid')))->firstOrFail();
        $order = fn () => MaintenanceOrder::query()->where('plant_id', $plant->id)->where('uuid', $request->input('uuid'))->firstOrFail();
        if (in_array($action, ['report.save', 'assignment.create', 'breakdown.create', 'order.create'], true) && $request->filled('equipment_uuid')) {
            Equipment::query()->where('plant_id', $plant->id)->where('uuid', $request->input('equipment_uuid'))->firstOrFail();
        }
        $filters = Validator::make($request->query(), (new WorkspaceFilterRequest)->rules())->validate();
        $page = $request->input('context_page', 'dashboard');
        abort_unless(in_array($page, self::PAGES, true), 422);

        $result = match ($action) {
            'report.save' => app(ReportWorkflow::class)->save($user, $input, $request->integer('version') > 0 ? $report() : null),
            'report.submit','report.review','report.return','report.approve' => app(ReportWorkflow::class)->transition($user, $report(), explode('.', $action)[1], $input),
            'fuel.verify' => app(ReportWorkflow::class)->verifyFuel($user, $report(), $input),
            'plan.create' => app(PlanningService::class)->createPlan($user, $input),
            'assignment.create' => app(PlanningService::class)->assign($user, $input),
            'breakdown.create' => app(MaintenanceService::class)->breakdown($user, $input),
            'order.create' => app(MaintenanceService::class)->order($user, $input),
            'order.action' => app(MaintenanceService::class)->action($user, $order(), $input),
            'order.release' => app(MaintenanceService::class)->release($user, $order(), $input),
            'equipment.save','person.save','location.save' => $this->saveMaster($request, $action, $plant),
            default => abort(404),
        };

        $result->refresh();

        return response()->json([...$this->workspace->screen($user, $plant, $page, $filters), 'mutation' => ['uuid' => $result->uuid, 'version' => $result->version]]);
    }

    private function saveMaster(Request $request, string $action, Plant $plant): mixed
    {
        $this->access->authorize($request->user(), $plant->id, 'master');
        $kind = explode('.', $action)[0];
        $table = ['equipment' => 'equipment', 'person' => 'people', 'location' => 'locations'][$kind];
        $class = ['equipment' => Equipment::class, 'person' => Person::class, 'location' => Location::class][$kind];
        $existing = $request->input('uuid') ? $class::query()->where('plant_id', $plant->id)->where('uuid', $request->input('uuid'))->firstOrFail() : null;
        $rules = ['code' => ['required', 'string', 'max:64', Rule::unique($table)->where('plant_id', $plant->id)->ignore($existing?->id)], 'name' => 'required|string|max:255', 'active' => 'sometimes|boolean', 'version' => 'required|integer|min:0'];
        $rules += match ($kind) {
            'equipment' => ['category' => 'required|in:heavy_equipment,vehicle,engine,genset', 'model' => 'nullable|string|max:255', 'plate' => 'nullable|string|max:32', 'ownership' => 'required|in:OWN,LEND,RENT,unverified', 'meter_unit' => 'required|in:HM,KM,H', 'version' => 'required|integer'],'person' => ['type' => 'required|in:operator,driver,helper,technician'],'location' => ['type' => 'required|in:estate,division,field,block,workshop,factory,office,route', 'sap_code' => 'nullable|string|max:64', 'parent_uuid' => 'nullable|uuid']
        };
        $data = $request->validate($rules);

        return DB::transaction(function () use ($request, $data, $existing, $class, $plant, $kind) {
            if ($kind === 'location') {
                $parent = empty($data['parent_uuid']) ? null : Location::query()->where('plant_id', $plant->id)->where('uuid', $data['parent_uuid'])->lockForUpdate()->firstOrFail();
                $ancestor = $parent;
                $visited = [];
                while ($ancestor) {
                    abort_if($ancestor->id === $existing?->id || in_array($ancestor->id, $visited, true), 422, 'Induk lokasi tidak boleh membentuk siklus.');
                    $visited[] = $ancestor->id;
                    $ancestor = $ancestor->parent_id ? Location::query()->where('plant_id', $plant->id)->whereKey($ancestor->parent_id)->lockForUpdate()->firstOrFail() : null;
                }
                $data['parent_id'] = $parent?->id;
                unset($data['parent_uuid']);
            }
            if ($existing) {
                $existing = $class::query()->whereKey($existing->id)->lockForUpdate()->firstOrFail();
                abort_unless($existing->version === $data['version'], 409, 'Versi master berubah. Muat ulang sebelum menyimpan.');
                if ($kind === 'equipment') {
                    if ($existing->reports()->exists()) {
                        abort_unless($existing->code === $data['code'] && $existing->meter_unit === $data['meter_unit'], 422, 'Kode dan satuan alat dengan histori memerlukan proses koreksi master.');
                    }
                }$existing->update([...$data, 'version' => $existing->version + 1]);
                $record = $existing;
            } else {
                abort_unless($data['version'] === 0, 409, 'Versi pembuatan master harus nol.');
                unset($data['version']);
                $record = $class::create([...$data, 'plant_id' => $plant->id]);
            }
            DB::table('audit_events')->insert(['plant_id' => $plant->id, 'actor_id' => $request->user()->id, 'action' => 'master.save', 'entity_type' => $kind, 'entity_uuid' => $record->uuid, 'details' => json_encode($record->toArray(), JSON_THROW_ON_ERROR), 'created_at' => now()]);

            return $record;
        });
    }

    public function previewDocument(Request $request, ExportService $exports): JsonResponse
    {
        $document = $this->document($request, $exports);
        $document['total_rows'] = count($document['rows']);
        $document['rows'] = array_slice($document['rows'], 0, 100);
        foreach ($document['sections'] as &$section) {
            $section['total_rows'] = count($section['rows']);
            $section['rows'] = array_slice($section['rows'], 0, 50);
        }
        unset($section);

        return response()->json($document);
    }

    public function export(Request $request, ExportService $exports): \Symfony\Component\HttpFoundation\Response
    {
        $request->validate(['output' => 'required|in:pdf,xlsx']);

        return $exports->download($this->document($request, $exports), $request->string('output')->toString());
    }

    private function document(Request $request, ExportService $exports): array
    {
        $plant = $this->access->plant($request->user(), $request->input('plant_uuid'), 'export');
        $filters = $exports->filters($request->all());
        if (! empty($filters['equipment_uuid'])) {
            Equipment::query()->where('plant_id', $plant->id)->where('uuid', $filters['equipment_uuid'])->firstOrFail();
        }
        if (! empty($filters['operator_uuid'])) {
            Person::query()->where('plant_id', $plant->id)->where('uuid', $filters['operator_uuid'])->firstOrFail();
        }
        $dataset = $this->workspace->documentData($request->user(), $plant, $filters);

        return $exports->build($dataset, $request->all(), $plant->name, $plant->timezone);
    }

    public function import(Request $request, WorkbookImporter $importer): JsonResponse
    {
        $data = $request->validate(['file' => 'required|file|mimes:xlsx,xls,csv|max:10240', 'kind' => 'required|in:iw47,daily', 'sap_system' => 'required_if:kind,iw47|nullable|string|max:32']);
        $file = $request->file('file');
        $plant = $this->access->plant($request->user(), $request->input('plant_uuid'), 'import');
        $checksum = hash_file('sha256', $file->getRealPath());
        $existing = ImportBatch::query()->where('plant_id', $plant->id)->where('kind', $data['kind'])->where('checksum', $checksum)->first();
        if ($existing) {
            return response()->json($existing->load('rows')->loadCount('rows'));
        }
        $path = $file->store('imports', 'local');
        $batch = ImportBatch::create(['plant_id' => $plant->id, 'created_by' => $request->user()->id, 'kind' => $data['kind'], 'filename' => $file->getClientOriginalName(), 'path' => $path, 'checksum' => $checksum, 'sap_system' => $data['sap_system'] ?? null]);
        ParseWorkbook::dispatch($batch->id);

        return response()->json($batch->fresh()->loadCount('rows'), 202);
    }

    public function attach(Request $request): JsonResponse
    {
        $request->validate(['report_uuid' => 'required|uuid', 'attachment_uuid' => 'nullable|uuid', 'checksum' => 'nullable|regex:/^[a-f0-9]{64}$/', 'file' => 'required|file|mimes:jpg,jpeg,png,pdf|max:5120']);
        $report = DailyReport::query()->where('uuid', $request->input('report_uuid'))->firstOrFail();
        app(ReportWorkflow::class)->authorizeEdit($request->user(), $report);
        $file = $request->file('file');
        $checksum = hash_file('sha256', $file->getRealPath());
        abort_if($request->filled('checksum') && ! hash_equals($checksum, $request->input('checksum')), 422, 'Checksum berkas tidak sesuai.');
        $uuid = $request->input('attachment_uuid') ?? (string) Str::uuid();
        $existing = DB::table('attachments')->where('uuid', $uuid)->first();
        if ($existing) {
            abort_unless($existing->daily_report_id === $report->id && hash_equals($existing->checksum, $checksum), 409, 'Identitas lampiran digunakan dengan isi berbeda.');

            return response()->json(['uuid' => $uuid, 'checksum' => $checksum]);
        }$path = $file->store('evidence', 'local');
        DB::table('attachments')->insert(['uuid' => $uuid, 'daily_report_id' => $report->id, 'uploaded_by' => $request->user()->id, 'path' => $path, 'original_name' => $file->getClientOriginalName(), 'mime' => $file->getMimeType(), 'size' => $file->getSize(), 'checksum' => hash_file('sha256', $file->getRealPath()), 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['uuid' => $uuid, 'checksum' => hash_file('sha256', $file->getRealPath())], 201);
    }

    public function downloadAttachment(Request $request, string $uuid): StreamedResponse
    {
        $file = DB::table('attachments')->where('uuid', $uuid)->first();
        abort_unless($file, 404);
        $report = DailyReport::findOrFail($file->daily_report_id);
        $this->access->authorize($request->user(), $report->plant_id);
        if ($this->access->ownOnly($request->user(), $report->plant_id)) {
            abort_unless($report->operator->user_id === $request->user()->id, 403);
        }

        return Storage::disk('local')->download($file->path, $file->original_name, ['Cache-Control' => 'private, no-store']);
    }
}

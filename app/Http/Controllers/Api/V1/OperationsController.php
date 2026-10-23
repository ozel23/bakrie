<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\WorkspaceFilterRequest;
use App\Models\Assignment;
use App\Models\Breakdown;
use App\Models\DailyReport;
use App\Models\Equipment;
use App\Models\MaintenanceOrder;
use App\Models\User;
use App\Services\Access;
use App\Services\MaintenanceService;
use App\Services\ReportWorkflow;
use App\Services\SyncService;
use App\Services\WorkspaceData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class OperationsController extends Controller
{
    public function __construct(private Access $access) {}

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email', 'password' => 'required|string', 'device_id' => 'required|uuid']);
        $user = User::query()->where('email', $data['email'])->first();
        if (! $user || ! $user->active || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Email atau kata sandi tidak valid.']);
        }
        $this->access->plant($user);
        $token = $user->createToken('device:'.$data['device_id'], ['epita', 'device:'.$data['device_id']], now()->addDays(config('epita.offline_days')));

        return response()->json(['token' => $token->plainTextToken, 'user' => $user->only('id', 'name', 'email'), 'offline_until' => now()->addDays(config('epita.offline_days'))->toIso8601String()]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()->only('id', 'name', 'email'), 'plant_ids' => $this->access->plantIds($request->user()), 'server_time' => now()->toIso8601String()]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['revoked' => true]);
    }

    public function bootstrap(Request $request, WorkspaceData $workspace): JsonResponse
    {
        $plant = $this->access->plant($request->user(), $request->query('plant'));

        return response()->json(['plant' => $plant, 'data' => $workspace->snapshot($request->user(), $plant), 'cursor' => (int) (DB::table('server_changes')->max('id') ?? 0), 'offline_until' => now()->addDays(config('epita.offline_days'))->toIso8601String()]);
    }

    public function index(Request $request, string $resource, WorkspaceData $workspace): JsonResponse
    {
        $plant = $this->access->plant($request->user(), $request->query('plant'));
        $class = match ($resource) {
            'daily-reports' => DailyReport::class,'assignments' => Assignment::class,'breakdowns' => Breakdown::class,'maintenance-orders' => MaintenanceOrder::class,default => abort(404)
        };
        $filters = Validator::make($request->query(), (new WorkspaceFilterRequest)->rules())->validate();
        $query = $resource === 'daily-reports' ? $workspace->reports($request->user(), $plant, $filters) : $class::query()->where('plant_id', $plant->id);
        if ($this->access->ownOnly($request->user(), $plant->id)) {
            if (in_array($resource, ['daily-reports', 'assignments'], true)) {
                $query->whereHas('operator', fn ($q) => $q->where('user_id', $request->user()->id));
            } elseif ($resource === 'breakdowns') {
                $query->where('reported_by', $request->user()->id);
            } else {
                $query->whereIn('equipment_id', Assignment::query()->whereHas('operator', fn ($q) => $q->where('user_id', $request->user()->id))->select('equipment_id'));
            }
        }

        return response()->json($query->orderByDesc('id')->paginate(min(max($request->integer('per_page', 20), 1), 100)));
    }

    public function showReport(Request $request, DailyReport $report): JsonResponse
    {
        $this->authorizeReportRead($request, $report);

        return response()->json($report->load('equipment', 'operator', 'activities.location', 'fuelEvents', 'approvals.actor'));
    }

    public function showEquipment(Request $request, Equipment $equipment): JsonResponse
    {
        $this->access->equipment($request->user(), $equipment);

        return response()->json($equipment->load('plant'));
    }

    public function saveReport(Request $request, ReportWorkflow $workflow, ?DailyReport $report = null): JsonResponse
    {
        return response()->json($workflow->save($request->user(), $request->all(), $report, 'api'), $report ? 200 : 201);
    }

    public function transition(Request $request, DailyReport $report, string $action, ReportWorkflow $workflow): JsonResponse
    {
        return response()->json($workflow->transition($request->user(), $report, $action, $request->all()));
    }

    public function fuel(Request $request, DailyReport $report, ReportWorkflow $workflow): JsonResponse
    {
        return response()->json($workflow->verifyFuel($request->user(), $report, $request->all()));
    }

    public function breakdown(Request $request, MaintenanceService $service): JsonResponse
    {
        return response()->json($service->breakdown($request->user(), $request->all()), 201);
    }

    public function order(Request $request, MaintenanceService $service): JsonResponse
    {
        return response()->json($service->order($request->user(), $request->all()), 201);
    }

    public function maintenanceAction(Request $request, MaintenanceOrder $order, MaintenanceService $service): JsonResponse
    {
        return response()->json($service->action($request->user(), $order, $request->all()));
    }

    public function release(Request $request, MaintenanceOrder $order, MaintenanceService $service): JsonResponse
    {
        return response()->json($service->release($request->user(), $order, $request->all()));
    }

    public function push(Request $request, SyncService $sync): JsonResponse
    {
        return response()->json($sync->push($request->user(), $request->all()));
    }

    public function pull(Request $request, SyncService $sync): JsonResponse
    {
        return response()->json($sync->pull($request->user(), $request->all()));
    }

    public function dashboard(Request $request, WorkspaceData $workspace): JsonResponse
    {
        $plant = $this->access->plant($request->user(), $request->query('plant'));

        return response()->json($workspace->snapshot($request->user(), $plant));
    }

    private function authorizeReportRead(Request $request, DailyReport $report): void
    {
        $this->access->authorize($request->user(), $report->plant_id);
        if ($this->access->ownOnly($request->user(), $report->plant_id)) {
            abort_unless($report->operator->user_id === $request->user()->id, 403);
        }
    }
}

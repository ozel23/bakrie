<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\Breakdown;
use App\Models\DailyReport;
use App\Models\Equipment;
use App\Models\FuelEvent;
use App\Models\ImportBatch;
use App\Models\Location;
use App\Models\MaintenanceOrder;
use App\Models\Person;
use App\Models\Plant;
use App\Models\ReportActivity;
use App\Models\User;
use App\Models\WorkPlan;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class WorkspaceData
{
    public function __construct(private Access $access) {}

    public function snapshot(User $user, Plant $plant): array
    {
        return $this->dataset($user, $plant);
    }

    public function screen(User $user, Plant $plant, string $page, array $filters): array
    {
        return $this->dataset($user, $plant, $filters, $page);
    }

    public function documentData(User $user, Plant $plant, array $filters): array
    {
        $this->access->authorize($user, $plant->id, 'export');

        return $this->dataset($user, $plant, $filters, null, $filters['format'] ?? null);
    }

    private function dataset(User $user, Plant $plant, array $filters = [], ?string $page = null, ?string $format = null): array
    {
        $this->access->authorize($user, $plant->id);
        if ($page !== null && empty($filters['start_date'])) {
            $month = CarbonImmutable::createFromFormat('!Y-m', $filters['period'] ?? now($plant->timezone)->format('Y-m'), $plant->timezone);
            $filters['start_date'] = $month->startOfMonth()->format('Y-m-d');
            $filters['end_date'] = $month->endOfMonth()->format('Y-m-d');
        }
        $own = $this->access->ownOnly($user, $plant->id);
        $pagination = [];
        $equipmentQuery = Equipment::query()->where('plant_id', $plant->id);
        $peopleQuery = Person::query()->where('plant_id', $plant->id);
        if ($own) {
            $equipmentQuery->where(fn (Builder $q) => $q
                ->whereIn('id', Assignment::query()->where('plant_id', $plant->id)->whereHas('operator', fn ($p) => $p->where('user_id', $user->id))->select('equipment_id'))
                ->orWhereIn('id', DailyReport::query()->where('plant_id', $plant->id)->whereHas('operator', fn ($p) => $p->where('user_id', $user->id))->select('equipment_id')));
            $peopleQuery->where(fn (Builder $q) => $q->where('user_id', $user->id)->orWhere('type', 'helper'));
        }
        $equipment = (clone $equipmentQuery)->orderBy('code')->get();
        $people = (clone $peopleQuery)->orderBy('name')->get();
        $locations = Location::query()->where('plant_id', $plant->id)->orderBy('code')->get();
        $reportQuery = $this->reports($user, $plant, $filters);
        $fuelPage = [];
        if ($page === 'fuel') {
            $fuelQuery = FuelEvent::query()->whereIn('daily_report_id', $this->reports($user, $plant, [...$filters, 'q' => null])->select('id'));
            if (! empty($filters['meaning'])) {
                $filters['meaning'] === 'unverified' ? $fuelQuery->where(fn ($q) => $q->where('meaning', 'unverified')->orWhereNull('verified_at')) : $fuelQuery->where('meaning', $filters['meaning']);
            }
            if (! empty($filters['q'])) {
                $fuelQuery->where(function ($q) use ($filters): void {
                    $q->where('fuel_type', 'like', $this->pattern($filters['q']))->orWhereHas('report', function ($r) use ($filters): void {
                        $this->search($r, $filters['q'], ['notes'], true, true);
                    });
                });
            }
            $fuelPage = $this->page($fuelQuery->orderByDesc('id'), 'fuel', $filters, $pagination)->pluck('uuid')->all();
            $reportQuery = $this->reports($user, $plant, [...$filters, 'q' => null])->whereHas('fuelEvents', fn ($q) => $q->whereIn('uuid', $fuelPage));
        }
        $metrics = $format === null ? $this->metrics($user, $plant, $filters, $equipmentQuery) : [];
        if ($page === 'approvals' && empty($filters['status'])) {
            $reportQuery->whereIn('status', ['submitted', 'reviewed']);
        }
        $reportQuery->with(['equipment', 'operator', 'activities.location', 'activities.planItem', 'fuelEvents', 'approvals.actor'])->orderByDesc('work_date')->orderByDesc('id');
        $reports = in_array($page, ['reports', 'approvals'], true)
            ? $this->page($reportQuery, 'reports', $filters, $pagination)
            : ($page === 'dashboard' ? $reportQuery->whereIn('status', ['submitted', 'reviewed'])->limit(8)->get() : ($page !== null && ! in_array($page, ['fuel', 'equipment'], true) ? collect() : $reportQuery->when(in_array($format, ['maintenance', 'downtime', 'quality'], true), fn ($q) => $q->whereRaw('1 = 0'))->get()));
        if (in_array($format, ['maintenance', 'downtime', 'quality'], true)) {
            $reports = collect();
        }
        $assignmentQuery = Assignment::query()->where('plant_id', $plant->id)
            ->when($own, fn ($q) => $q->whereHas('operator', fn ($p) => $p->where('user_id', $user->id)));
        $this->interval($assignmentQuery, $filters, 'starts_at', 'ends_at', $plant->timezone);
        $this->search($assignmentQuery, $filters['q'] ?? null, ['reason'], true, true);
        $assignments = $page === 'planning' ? $this->page((clone $assignmentQuery)->with('equipment', 'operator', 'planItem')->orderByDesc('starts_at')->orderByDesc('id'), 'assignments', $filters, $pagination)
            : ($page === null && $format === null ? $assignmentQuery->with('equipment', 'operator', 'planItem')->orderByDesc('starts_at')->get() : collect());
        $planQuery = WorkPlan::query()->where('plant_id', $plant->id);
        if ($own) {
            $planQuery->whereHas('items', fn ($q) => $q->whereIn('id', Assignment::query()->where('plant_id', $plant->id)->whereHas('operator', fn ($p) => $p->where('user_id', $user->id))->select('plan_item_id')));
        }
        if (! empty($filters['start_date'])) {
            $planQuery->where('starts_on', '<=', $filters['end_date'])->where('ends_on', '>=', $filters['start_date']);
        }
        if (! empty($filters['q'])) {
            $planQuery->where('title', 'like', $this->pattern($filters['q']));
        }
        $plans = $page === 'planning' ? $this->page((clone $planQuery)->with('items.location')->orderByDesc('id'), 'plans', $filters, $pagination)
            : (in_array($page, [null, 'reports', 'approvals'], true) && in_array($format, [null, 'plan'], true) ? $planQuery->with('items.location')->orderByDesc('id')->get() : collect());
        $actuals = $plans->isEmpty() ? collect() : ReportActivity::query()->whereIn('daily_report_id', $this->reports($user, $plant, [...$filters, 'status' => 'approved'])->select('id'))
            ->whereNotNull('plan_item_id')->selectRaw('plan_item_id, unit, SUM(quantity) as actual')->groupBy('plan_item_id', 'unit')->get()->keyBy(fn ($row) => $row->plan_item_id.'|'.$row->unit);
        foreach ($plans as $plan) {
            foreach ($plan->items as $item) {
                $item->setAttribute('actual', (string) ($actuals[$item->id.'|'.$item->unit]->actual ?? '0.000'));
            }
        }
        $orderQuery = MaintenanceOrder::query()->where('plant_id', $plant->id)->whereIn('equipment_id', (clone $equipmentQuery)->select('id'));
        $this->interval($orderQuery, $filters, 'starts_at', 'released_at', $plant->timezone);
        $this->search($orderQuery, $filters['q'] ?? null, ['diagnosis'], true);
        $orders = $page === 'maintenance' ? $this->page((clone $orderQuery)->with('equipment', 'breakdown', 'actions.technician')->orderByDesc('id'), 'orders', $filters, $pagination)
            : (($page === null && in_array($format, [null, 'maintenance', 'downtime'], true)) || $page === 'equipment' ? $orderQuery->with('equipment', 'breakdown', 'actions.technician')->orderByDesc('id')->get() : collect());
        $breakdownQuery = Breakdown::query()->where('plant_id', $plant->id)->whereIn('equipment_id', (clone $equipmentQuery)->select('id'));
        if (! empty($filters['end_date'])) {
            $breakdownQuery->where('occurred_at', '<', CarbonImmutable::parse($filters['end_date'], $plant->timezone)->addDay()->utc());
        }
        $this->search($breakdownQuery, $filters['q'] ?? null, ['description'], true);
        $breakdowns = $page === 'maintenance' ? $this->page((clone $breakdownQuery)->with('equipment')->orderByDesc('id'), 'breakdowns', $filters, $pagination)
            : ($page === null && in_array($format, [null, 'downtime'], true) ? $breakdownQuery->with('equipment')->orderByDesc('id')->get() : collect());
        $breakdownEnds = DB::table('downtime_intervals')->whereIn('breakdown_id', $breakdowns->pluck('id'))->pluck('ends_at', 'breakdown_id');
        foreach ($breakdowns as $breakdown) {
            $breakdown->setAttribute('ended_at', $breakdownEnds[$breakdown->id] ?? null);
        }
        if ($format === null) {
            $metrics['assignments'] = (clone $assignmentQuery)->count();
            $metrics['assigned_equipment'] = (clone $assignmentQuery)->distinct()->count('equipment_id');
            $metrics['plans'] = (clone $planQuery)->count();
            $metrics['orders'] = (clone $orderQuery)->count();
            $metrics['released_orders'] = (clone $orderQuery)->where('status', 'released')->count();
            $metrics['breakdowns'] = (clone $breakdownQuery)->count();
        }
        $catalogRows = [];
        foreach (['equipment' => clone $equipmentQuery, 'people' => clone $peopleQuery, 'locations' => Location::query()->where('plant_id', $plant->id)] as $resource => $query) {
            if ($page !== $resource) {
                continue;
            }
            $this->search($query, $filters['q'] ?? null, $resource === 'equipment' ? ['code', 'name', 'plate'] : ['code', 'name']);
            if ($resource === 'equipment') {
                foreach (['category', 'condition'] as $field) {
                    if (! empty($filters[$field]) && $filters[$field] !== 'all') {
                        $query->where($field, $filters[$field]);
                    }
                }
            }
            $catalogRows[$resource] = $this->page($query->orderBy('code')->orderBy('id'), $resource, $filters, $pagination)->toArray();
        }
        $personRows = DB::table('report_people')->join('people', 'people.id', '=', 'report_people.person_id')->whereIn('daily_report_id', $reports->pluck('id'))->select('report_people.*', 'people.uuid as person_uuid')->get()->groupBy('daily_report_id');
        $attachments = DB::table('attachments')->whereIn('daily_report_id', $reports->pluck('id'))->get()->groupBy('daily_report_id');
        $parts = DB::table('maintenance_parts')->whereIn('maintenance_action_id', $orders->flatMap(fn ($o) => $o->actions->pluck('id')))->get()->groupBy('maintenance_action_id');
        $permissions = $this->access->permissions($user, $plant->id);
        $importQuery = ImportBatch::query()->where('plant_id', $plant->id)->withCount('rows')->with('rows')->orderByDesc('id');
        $imports = ! in_array('import', $permissions, true) ? [] : ($page === 'integrations' ? $this->page($importQuery, 'imports', $filters, $pagination)->toArray() : ($page === null && in_array($format, [null, 'quality'], true) ? $importQuery->get()->toArray() : []));

        $locationMap = $locations->keyBy('id');
        $locationRow = fn ($row) => [...(is_array($row) ? $row : $row->toArray()), 'parent_uuid' => isset($row['parent_id']) ? ($locationMap[$row['parent_id']]->uuid ?? null) : null];
        if (isset($catalogRows['locations'])) {
            $catalogRows['locations'] = array_map($locationRow, $catalogRows['locations']);
        }

        return ['equipment' => $equipment->values()->toArray(), 'people' => $people->values()->toArray(), 'locations' => $locations->map($locationRow)->values()->all(),
            'reports' => $reports->map(fn ($r) => [
                'uuid' => $r->uuid, 'equipment_uuid' => $r->equipment->uuid, 'operator_uuid' => $r->operator->uuid, 'work_date' => $r->work_date->format('Y-m-d'), 'shift' => $r->shift, 'version' => $r->version, 'status' => $r->status, 'condition' => $r->condition, 'meter_start' => $r->meter_start ?? '', 'meter_end' => $r->meter_end ?? '', 'meter_delta' => $r->meter_delta, 'meter_unit' => $r->meter_unit, 'work_seconds' => $r->work_seconds ?? 0, 'notes' => $r->notes ?? '', 'exception_reason' => $r->exception_reason,
                'activities' => $r->activities->map(fn ($a) => array_merge($a->toArray(), ['location_uuid' => $a->location?->uuid ?? '', 'plan_item_uuid' => $a->planItem?->uuid, 'quantity' => $a->quantity ?? '', 'unit' => $a->unit ?? '']))->all(),
                'fuel_events' => $r->fuelEvents->toArray(),
                'helpers' => ($personRows[$r->id] ?? collect())->where('role', 'helper')->map(fn ($h) => ['person_uuid' => $h->person_uuid, 'overtime_minutes' => $h->overtime_minutes])->values()->all(),
                'overtime_minutes' => ($personRows[$r->id] ?? collect())->firstWhere('role', 'operator')?->overtime_minutes ?? 0,
                'history' => $r->approvals->map(fn ($a) => ['status' => $a->to_status, 'at' => $a->created_at->toIso8601String(), 'actor' => $a->actor->name, 'reason' => $a->reason, 'version' => $a->report_version])->all(),
                'attachments' => ($attachments[$r->id] ?? collect())->map(fn ($a) => ['uuid' => $a->uuid, 'name' => $a->original_name, 'url' => route('attachments.download', $a->uuid)])->all(),
            ])->all(),
            'plans' => $plans->map(fn ($p) => array_merge($p->toArray(), ['items' => $p->items->map(fn ($i) => array_merge($i->toArray(), ['location_uuid' => $i->location->uuid]))->all()]))->all(),
            'assignments' => $assignments->map(fn ($a) => array_merge($a->toArray(), ['equipment_uuid' => $a->equipment->uuid, 'operator_uuid' => $a->operator->uuid, 'plan_item_uuid' => $a->planItem?->uuid]))->all(),
            'breakdowns' => $breakdowns->map(fn ($b) => array_merge($b->toArray(), ['equipment_uuid' => $b->equipment->uuid]))->all(),
            'orders' => $orders->map(fn ($o) => array_merge($o->toArray(), ['equipment_uuid' => $o->equipment->uuid, 'breakdown_uuid' => $o->breakdown?->uuid, 'actions' => $o->actions->map(fn ($a) => array_merge($a->toArray(), ['technician_uuid' => $a->technician->uuid, 'parts' => ($parts[$a->id] ?? collect())->all()]))->all()]))->all(),
            'imports' => $imports, 'metrics' => $metrics, 'pagination' => $pagination, 'catalog_rows' => $catalogRows, 'fuel_page_uuids' => $fuelPage];
    }

    public function reports(User $user, Plant $plant, array $filters = []): Builder
    {
        if (! empty($filters['period']) && empty($filters['start_date'])) {
            $month = CarbonImmutable::createFromFormat('!Y-m', $filters['period'], $plant->timezone);
            $filters['start_date'] = $month->startOfMonth()->format('Y-m-d');
            $filters['end_date'] = $month->endOfMonth()->format('Y-m-d');
        }
        $this->access->authorize($user, $plant->id);
        $query = DailyReport::query()->where('plant_id', $plant->id)
            ->when($this->access->ownOnly($user, $plant->id), fn ($q) => $q->whereHas('operator', fn ($p) => $p->where('user_id', $user->id)));
        if (! empty($filters['start_date'])) {
            $query->whereBetween('work_date', [$filters['start_date'], $filters['end_date']]);
        }
        foreach (['equipment_uuid' => 'equipment', 'operator_uuid' => 'operator'] as $key => $relation) {
            if (! empty($filters[$key])) {
                $query->whereHas($relation, fn ($q) => $q->where('uuid', $filters[$key]));
            }
        }
        if (($filters['status'] ?? 'all') === 'pending') {
            $query->whereIn('status', ['submitted', 'reviewed']);
        } elseif (! empty($filters['status']) && $filters['status'] !== 'all') {
            $query->where('status', $filters['status']);
        }
        $this->search($query, $filters['q'] ?? null, ['notes'], true, true, true);

        return $query;
    }

    private function page(Builder $query, string $resource, array $filters, array &$pagination): Collection
    {
        $result = $query->paginate((int) ($filters[$resource.'_per_page'] ?? 8), ['*'], $resource.'_page', (int) ($filters[$resource.'_page'] ?? 1));
        if ($result->currentPage() > $result->lastPage()) {
            $result = $query->paginate((int) ($filters[$resource.'_per_page'] ?? 8), ['*'], $resource.'_page', $result->lastPage());
        }
        $pagination[$resource] = ['total' => $result->total(), 'current_page' => $result->currentPage(), 'last_page' => $result->lastPage(), 'per_page' => $result->perPage(), 'from' => $result->firstItem(), 'to' => $result->lastItem()];

        return collect($result->items());
    }

    private function pattern(string $search): string
    {
        return '%'.str_replace(['%', '_', '['], ['[%]', '[_]', '[[]'], trim($search)).'%';
    }

    private function search(Builder $query, ?string $search, array $fields, bool $equipment = false, bool $operator = false, bool $activities = false): void
    {
        if ($search === null || trim($search) === '') {
            return;
        }
        $pattern = $this->pattern($search);
        $query->where(function (Builder $q) use ($fields, $pattern, $equipment, $operator, $activities): void {
            foreach ($fields as $field) {
                $q->orWhere($field, 'like', $pattern);
            }
            if ($equipment) {
                $q->orWhereHas('equipment', fn ($e) => $e->where('name', 'like', $pattern)->orWhere('code', 'like', $pattern));
            }
            if ($operator) {
                $q->orWhereHas('operator', fn ($p) => $p->where('name', 'like', $pattern)->orWhere('code', 'like', $pattern));
            }
            if ($activities) {
                $q->orWhereHas('activities', fn ($a) => $a->where('description', 'like', $pattern));
            }
        });
    }

    private function interval(Builder $query, array $filters, string $start, string $end, string $timezone): void
    {
        if (empty($filters['start_date'])) {
            return;
        }
        $from = CarbonImmutable::parse($filters['start_date'], $timezone)->utc();
        $to = CarbonImmutable::parse($filters['end_date'], $timezone)->addDay()->utc();
        $query->where($start, '<', $to)->where(fn ($q) => $q->whereNull($end)->orWhere($end, '>=', $from));
    }

    private function metrics(User $user, Plant $plant, array $filters, Builder $equipment): array
    {
        $base = $this->reports($user, $plant, [...$filters, 'status' => 'all']);
        $approved = (clone $base)->where('status', 'approved');
        $counts = (clone $base)->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status')->map(fn ($value) => (int) $value)->all();
        $meter = [];
        foreach (['HM', 'KM', 'H'] as $unit) {
            $meter[$unit] = (clone $approved)->where('meter_unit', $unit)->selectRaw('SUM(meter_delta) as total')->value('total');
        }
        $fuel = FuelEvent::query()->whereIn('daily_report_id', (clone $approved)->select('id'))->whereNotNull('verified_at')->where('unit', 'L');
        $receipt = (clone $fuel)->where('meaning', 'receipt')->selectRaw('SUM(quantity) as total')->value('total');
        $consumption = (clone $fuel)->where('meaning', 'consumption')->selectRaw('SUM(quantity) as total')->value('total');
        $pending = FuelEvent::query()->whereIn('daily_report_id', (clone $base)->select('id'))->where(fn ($q) => $q->where('meaning', 'unverified')->orWhereNull('verified_at'))->count();
        $conditions = (clone $equipment)->where('active', true)->selectRaw('condition, COUNT(*) as total')->groupBy('condition')->pluck('total', 'condition')->map(fn ($value) => (int) $value)->all();
        $trend = (clone $approved)->selectRaw('work_date, meter_unit, SUM(meter_delta) as total')->groupBy('work_date', 'meter_unit')->get()->map(fn ($row) => ['date' => $row->work_date->format('Y-m-d'), 'unit' => $row->meter_unit, 'total' => $row->total])->all();

        return ['report_counts' => $counts, 'reports' => array_sum($counts), 'meter' => $meter, 'receipt_liters' => $receipt, 'consumption_liters' => $consumption, 'fuel_pending' => $pending, 'equipment_conditions' => $conditions, 'active_equipment' => array_sum($conditions), 'trend' => $trend,
            'open_breakdowns' => Breakdown::query()->where('plant_id', $plant->id)->whereIn('equipment_id', (clone $equipment)->select('id'))->where('status', 'open')->count(),
            'active_orders' => MaintenanceOrder::query()->where('plant_id', $plant->id)->whereIn('equipment_id', (clone $equipment)->select('id'))->where('status', '!=', 'released')->count(),
            'cutoff' => now()->toIso8601String(), 'start_date' => $filters['start_date'] ?? null, 'end_date' => $filters['end_date'] ?? null];
    }
}

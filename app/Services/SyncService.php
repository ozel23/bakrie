<?php

namespace App\Services;

use App\Models\DailyReport;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Laravel\Sanctum\PersonalAccessToken;

class SyncService
{
    public function __construct(private ReportWorkflow $reports, private Access $access) {}

    public function push(User $user, array $input): array
    {
        $data = Validator::make($input, ['device_id' => 'required|uuid', 'operations' => 'required|array|min:1|max:25', 'operations.*.operation_id' => 'required|uuid', 'operations.*.entity_id' => 'required|uuid', 'operations.*.entity_type' => 'required|in:daily_report', 'operations.*.action' => 'required|in:create_draft,update_draft,submit', 'operations.*.base_version' => 'required|integer|min:0', 'operations.*.payload' => 'present|array', 'operations.*.dependency_operation_id' => 'nullable|uuid'])->validate();
        $token = $user->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            abort_unless($token->can('device:'.$data['device_id']), 403, 'Token bukan milik perangkat ini.');
        }
        $results = [];
        foreach ($data['operations'] as $operation) {
            $results[] = DB::transaction(function () use ($user, $data, $operation): array {
                User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
                abort_unless($user->fresh()->active, 403);
                $encoded = json_encode($this->canonical($operation), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
                abort_if(strlen($encoded) > 524288, 422, 'Payload operasi terlalu besar.');
                $hash = hash('sha256', $encoded);
                $scope = ['user_id' => $user->id, 'device_id' => $data['device_id'], 'operation_id' => $operation['operation_id']];
                $receipt = DB::table('sync_receipts')->where($scope)->first();
                if ($receipt) {
                    abort_unless(hash_equals($receipt->payload_hash, $hash), 409, 'Operation ID digunakan kembali dengan payload berbeda.');
                    $prior = json_decode($receipt->result, true, 512, JSON_THROW_ON_ERROR);
                    $report = DailyReport::query()->where('uuid', $prior['entity_id'])->firstOrFail();
                    $this->access->authorize($user, $report->plant_id);

                    return $prior;
                }
                if (! empty($operation['dependency_operation_id'])) {
                    abort_unless(DB::table('sync_receipts')->where('user_id', $user->id)->where('device_id', $data['device_id'])->where('operation_id', $operation['dependency_operation_id'])->exists(), 409, 'Operasi dependency belum diakui server.');
                }
                $payload = [...$operation['payload'], 'uuid' => $operation['entity_id'], 'version' => $operation['base_version']];
                if ($operation['action'] === 'create_draft') {
                    abort_if(DailyReport::query()->where('uuid', $operation['entity_id'])->exists(), 409, 'Identitas draft sudah digunakan.');
                    $report = $this->reports->save($user, $payload, null, 'sync');
                } else {
                    $report = DailyReport::query()->where('uuid', $operation['entity_id'])->firstOrFail();
                    $this->access->authorize($user, $report->plant_id);
                    $report = $operation['action'] === 'update_draft' ? $this->reports->save($user, $payload, $report, 'sync') : $this->reports->transition($user, $report, 'submit', $payload);
                }
                $result = ['operation_id' => $operation['operation_id'], 'entity_id' => $report->uuid, 'version' => $report->version, 'status' => $report->status, 'applied_at' => now()->toIso8601String(), 'receipt_hash' => $hash];
                DB::table('sync_receipts')->insert([...$scope, 'payload_hash' => $hash, 'result' => json_encode($result, JSON_THROW_ON_ERROR), 'created_at' => now()]);

                return $result;
            });
        }

        return ['receipts' => $results];
    }

    public function pull(User $user, array $input): array
    {
        $data = Validator::make($input, ['cursor' => 'sometimes|integer|min:0', 'until' => 'sometimes|integer|min:0'])->validate();
        $cursor = (int) ($data['cursor'] ?? 0);
        $until = (int) ($data['until'] ?? DB::table('server_changes')->max('id') ?? 0);
        abort_if($until < $cursor, 422, 'Cursor tidak valid.');
        $plants = $this->access->plantIds($user);
        $changes = DB::table('server_changes')->where('id', '>', $cursor)->where('id', '<=', $until)->whereIn('plant_id', $plants)->where(function ($q) use ($user, $plants) {
            foreach ($plants as $id) {
                $q->orWhere(function ($scope) use ($user, $id) {
                    $scope->where('plant_id', $id);
                    if ($this->access->ownOnly($user, $id)) {
                        $scope->where('owner_id', $user->id);
                    }
                });
            }
        })->orderBy('id')->limit(101)->get();
        $more = $changes->count() > 100;
        $changes = $changes->take(100);

        return ['changes' => $changes->map(fn ($c) => ['cursor' => $c->id, 'entity_type' => $c->entity_type, 'entity_id' => $c->entity_uuid, 'deleted' => (bool) $c->deleted, 'payload' => json_decode($c->payload, true, 512, JSON_THROW_ON_ERROR)])->all(), 'cursor' => $more ? (int) $changes->last()->id : $until, 'until' => $until, 'has_more' => $more];
    }

    private function canonical(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }if (! array_is_list($value)) {
            ksort($value, SORT_STRING);
        }

        return array_map($this->canonical(...), $value);
    }
}

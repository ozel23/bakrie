<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\Equipment;
use App\Models\Membership;
use App\Models\Plant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class Access
{
    public function plantIds(User $user, string $permission = 'read'): array
    {
        if (! $user->active) {
            return [];
        }

        return Membership::query()->where('user_id', $user->id)->where('active', true)
            ->whereHas('plant', fn (Builder $q) => $q->where('active', true)->whereHas('company', fn (Builder $q) => $q->where('active', true)))
            ->get()->filter(fn (Membership $m) => in_array($permission, config("epita.permissions.{$m->role}", []), true))->pluck('plant_id')->unique()->values()->all();
    }

    public function authorize(User $user, int $plantId, string $permission = 'read'): void
    {
        abort_unless(in_array($plantId, $this->plantIds($user, $permission), true), 403, 'Anda tidak berhak melakukan tindakan ini pada plant tersebut.');
    }

    public function plant(User $user, ?string $uuid = null, string $permission = 'read'): Plant
    {
        $ids = $this->plantIds($user, $permission);
        abort_if($ids === [], 403, 'Akun Anda belum memiliki akses plant aktif untuk tindakan ini. Hubungi administrator perusahaan untuk memeriksa keanggotaan dan izin Anda.');
        $query = Plant::query()->whereIn('id', $ids);

        return ($uuid ? $query->where('uuid', $uuid) : $query->orderBy('name'))->firstOrFail();
    }

    public function permissions(User $user, int $plantId): array
    {
        return Membership::query()->where('user_id', $user->id)->where('plant_id', $plantId)->where('active', true)->pluck('role')->flatMap(fn (string $role) => config("epita.permissions.$role", []))->unique()->values()->all();
    }

    public function ownOnly(User $user, int $plantId): bool
    {
        $permissions = $this->permissions($user, $plantId);

        return in_array('report-own', $permissions, true) && ! array_intersect(['approve', 'report-delegate', 'master', 'export', 'maintain'], $permissions);
    }

    public function equipment(User $user, Equipment $equipment): void
    {
        $this->authorize($user, $equipment->plant_id);
        if ($this->ownOnly($user, $equipment->plant_id)) {
            $assigned = Assignment::query()->where('equipment_id', $equipment->id)->whereHas('operator', fn ($q) => $q->where('user_id', $user->id))->exists();
            $reported = $equipment->reports()->whereHas('operator', fn ($q) => $q->where('user_id', $user->id))->exists();
            abort_unless($assigned || $reported, 403, 'Equipment tidak terkait tugas atau laporan Anda.');
        }
    }
}

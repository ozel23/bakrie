<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MaintenanceOrder extends DomainRecord
{
    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function breakdown(): BelongsTo
    {
        return $this->belongsTo(Breakdown::class);
    }

    public function actions(): HasMany
    {
        return $this->hasMany(MaintenanceAction::class);
    }

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'released_at' => 'datetime', 'release_checklist' => 'array'];
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Equipment extends DomainRecord
{
    protected $table = 'equipment';

    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(DailyReport::class);
    }

    public function breakdowns(): HasMany
    {
        return $this->hasMany(Breakdown::class);
    }

    protected function casts(): array
    {
        return ['active' => 'boolean', 'last_meter' => 'decimal:3', 'condition_at' => 'datetime'];
    }
}

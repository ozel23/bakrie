<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FuelEvent extends DomainRecord
{
    public function report(): BelongsTo
    {
        return $this->belongsTo(DailyReport::class, 'daily_report_id');
    }

    protected function casts(): array
    {
        return ['quantity' => 'decimal:3', 'meter' => 'decimal:3', 'verified_at' => 'datetime'];
    }
}

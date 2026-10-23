<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DailyReport extends DomainRecord
{
    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'operator_id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(ReportActivity::class);
    }

    public function fuelEvents(): HasMany
    {
        return $this->hasMany(FuelEvent::class);
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(ApprovalEvent::class);
    }

    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class);
    }

    protected function casts(): array
    {
        return ['work_date' => 'date:Y-m-d', 'meter_start' => 'decimal:3', 'meter_end' => 'decimal:3', 'meter_delta' => 'decimal:3', 'confirmed_at' => 'datetime', 'approved_at' => 'datetime'];
    }
}

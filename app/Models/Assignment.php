<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Assignment extends DomainRecord
{
    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'operator_id');
    }

    public function planItem(): BelongsTo
    {
        return $this->belongsTo(PlanItem::class);
    }

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }
}

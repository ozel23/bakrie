<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Breakdown extends DomainRecord
{
    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }
}

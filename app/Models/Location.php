<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Location extends DomainRecord
{
    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'parent_id');
    }

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}

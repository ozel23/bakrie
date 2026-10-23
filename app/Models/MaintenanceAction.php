<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceAction extends DomainRecord
{
    public function technician(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'technician_id');
    }

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanItem extends DomainRecord
{
    public function plan(): BelongsTo
    {
        return $this->belongsTo(WorkPlan::class, 'work_plan_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    protected function casts(): array
    {
        return ['target' => 'decimal:3'];
    }
}

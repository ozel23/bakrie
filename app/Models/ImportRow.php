<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportRow extends DomainRecord
{
    public function batch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class, 'import_batch_id');
    }

    protected function casts(): array
    {
        return ['raw_payload' => 'array', 'normalized' => 'array', 'issues' => 'array'];
    }
}

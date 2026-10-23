<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportBatch extends DomainRecord
{
    public function rows(): HasMany
    {
        return $this->hasMany(ImportRow::class);
    }
}

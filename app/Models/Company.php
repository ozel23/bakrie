<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends DomainRecord
{
    public function plants(): HasMany
    {
        return $this->hasMany(Plant::class);
    }

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}

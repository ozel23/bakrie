<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Person extends DomainRecord
{
    protected $table = 'people';

    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}

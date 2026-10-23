<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalEvent extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'membership_snapshot' => 'array', 'created_at' => 'datetime'];
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PracticeSession extends Model
{
    protected $fillable = ['module_progress_id', 'practice_type', 'score', 'completed_at'];

    protected function casts(): array
    {
        return ['completed_at' => 'datetime'];
    }

    public function moduleProgress(): BelongsTo
    {
        return $this->belongsTo(ModuleProgress::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssessmentAttemptAnswer extends Model
{
    public $timestamps = false;

    protected $fillable = ['attempt_id', 'question_id', 'answer', 'correct'];

    protected function casts(): array
    {
        return ['correct' => 'boolean'];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(AssessmentAttempt::class, 'attempt_id');
    }
}

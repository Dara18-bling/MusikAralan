<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssessmentAttempt extends Model
{
    public $timestamps = false;

    protected $fillable = ['assessment_id', 'student_id', 'legacy_key', 'score', 'passed', 'submitted_at'];

    protected function casts(): array
    {
        return ['passed' => 'boolean', 'submitted_at' => 'datetime'];
    }

    public function answers(): HasMany
    {
        return $this->hasMany(AssessmentAttemptAnswer::class, 'attempt_id');
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }
}

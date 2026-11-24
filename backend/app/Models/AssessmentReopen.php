<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssessmentReopen extends Model
{
    protected $fillable = [
        'assessment_id',
        'student_id',
        'extra_attempts',
    ];

    protected function casts(): array
    {
        return [
            'extra_attempts' => 'integer',
        ];
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }
}

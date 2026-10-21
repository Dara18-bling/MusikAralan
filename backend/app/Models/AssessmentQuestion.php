<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssessmentQuestion extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'assessment_id',
        'position',
        'prompt',
        'type',
        'options',
        'correct_option_index',
        'correct_answer',
    ];

    protected function casts(): array
    {
        return ['options' => 'array'];
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }
}

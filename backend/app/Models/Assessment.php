<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assessment extends Model
{
    protected $fillable = ['class_id', 'title', 'passing_percent'];

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class, 'class_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(AssessmentQuestion::class)->orderBy('position');
    }
}

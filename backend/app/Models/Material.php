<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Material extends Model
{
    use SoftDeletes;

        protected $fillable = [
        'module_id',
        'class_id',
        'teacher_id',
        'title',
        'description',
        'kind',
        'media_url',
        'stream_url',
        'deadline',
        'requires_submission',
        'max_grade',
        'storage_path',
        'notation_status',
        'musicxml_path',
        'notation_error',
        'notation_processed_at',
        ];

    protected function casts(): array
    {
        return [
            'deadline' => 'datetime',
            'requires_submission' => 'boolean',
            'max_grade' => 'integer',
            'notation_processed_at' => 'datetime',
        ];
    }

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class, 'class_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }

    public function voiceGroup(): BelongsTo
    {
        return $this->belongsTo(VoiceGroup::class);
    }
}

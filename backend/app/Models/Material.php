<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Material extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'class_id',
        'module_id',
        'voice_group_id',
        'legacy_id',
        'teacher_id',
        'title',
        'description',
        'kind',
        'media_url',
        'stream_url',
        'storage_path',
        'is_assignment',
        'available_from',
        'due_at',
        'allow_late_submissions',
        'max_points',
    ];

    protected function casts(): array
    {
        return [
            'is_assignment' => 'boolean',
            'available_from' => 'datetime',
            'due_at' => 'datetime',
            'allow_late_submissions' => 'boolean',
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

    public function submissions(): HasMany
    {
        return $this->hasMany(AssignmentSubmission::class);
    }
}

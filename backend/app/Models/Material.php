<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Material extends Model
{
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
    ];

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

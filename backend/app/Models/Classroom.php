<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Classroom extends Model
{
    protected $table = 'classes';

    protected $fillable = [
        'legacy_id',
        'name',
        'teacher_id',
        'age_group',
        'description',
        'available_for_enrollment',
        'deleted',
        'enrollment_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'available_for_enrollment' => 'boolean',
            'deleted' => 'boolean',
            'enrollment_updated_at' => 'datetime',
        ];
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'enrollments', 'class_id', 'student_id')
            ->withPivot('enrolled_at');
    }

    public function materials(): HasMany
    {
        return $this->hasMany(Material::class, 'class_id');
    }

    public function assessment(): HasOne
    {
        return $this->hasOne(Assessment::class, 'class_id');
    }
}

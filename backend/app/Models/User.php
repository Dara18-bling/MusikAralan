<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'firebase_uid',
    'password',
    'name',
    'email',
    'email_verified_at',
    'birthday',
    'birth_year',
    'phone_number',
    'phone_verified',
    'messenger_link',
    'role',
    'status',
    'approved_by',
    'approved_at',
    'access_until',
    'date_requested',
])]
#[Hidden(['firebase_uid', 'password', 'remember_token'])]
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'birthday' => 'date:Y-m-d',
            'access_until' => 'date:Y-m-d',
            'date_requested' => 'datetime',
            'approved_at' => 'datetime',
            'phone_verified' => 'boolean',
        ];
    }

    public function classes(): BelongsToMany
    {
        return $this->belongsToMany(Classroom::class, 'enrollments', 'student_id', 'class_id')
            ->withPivot('enrolled_at');
    }

    public function voiceGroups(): BelongsToMany
    {
        return $this->belongsToMany(VoiceGroup::class, 'user_voice_group')
            ->withPivot('voice_part')
            ->withTimestamps();
    }

    public function moduleProgress(): HasMany
    {
        return $this->hasMany(ModuleProgress::class);
    }

    public function scheduleEvents(): HasMany
    {
        return $this->hasMany(ScheduleEvent::class, 'created_by');
    }
}

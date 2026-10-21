<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
            'phone_verified' => 'boolean',
        ];
    }

    public function classes(): BelongsToMany
    {
        return $this->belongsToMany(Classroom::class, 'enrollments', 'student_id', 'class_id')
            ->withPivot('enrolled_at');
    }
}

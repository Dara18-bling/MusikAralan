<?php

use App\Models\Classroom;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('users.{userId}', fn (User $user, int $userId): bool => (int) $user->id === $userId);

Broadcast::channel('roles.{role}', fn (User $user, string $role): bool => (
    $user->status === 'approved' && $user->role === $role
));

Broadcast::channel('admins', fn (User $user): bool => $user->status === 'approved' && $user->role === 'admin');

Broadcast::channel('classes.{classId}', function (User $user, int $classId): bool {
    if ($user->status !== 'approved') {
        return false;
    }

    if ($user->role === 'admin') {
        return true;
    }

    $class = Classroom::query()->find($classId);
    if (! $class) {
        return false;
    }

    if ($user->role === 'teacher') {
        return (int) $class->teacher_id === (int) $user->id;
    }

    return $user->role === 'student'
        && $class->students()->where('users.id', $user->id)->exists();
});

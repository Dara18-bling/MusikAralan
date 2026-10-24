<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssessmentAttempt;
use App\Models\Classroom;
use App\Models\Module;
use App\Models\ModuleProgress;
use App\Models\ScheduleEvent;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');

        if ($user->role === 'admin') {
            return response()->json(['dashboard' => [
                'pendingApprovals' => User::query()->where('status', 'pending')->count(),
                'users' => User::query()->count(),
                'classes' => Classroom::query()->where('deleted', false)->count(),
                'modules' => Module::query()->count(),
                'materials' => DB::table('materials')->count(),
                'completedModules' => ModuleProgress::query()->where('status', 'completed')->count(),
            ]]);
        }

        if ($user->role === 'teacher') {
            $classIds = Classroom::query()->where('teacher_id', $user->id)->where('deleted', false)->pluck('id');
            $studentCount = DB::table('enrollments')
                ->join('users', 'users.id', '=', 'enrollments.student_id')
                ->whereIn('class_id', $classIds)
                ->where('users.status', 'approved')
                ->distinct()
                ->count('student_id');

            return response()->json(['dashboard' => [
                'students' => $studentCount,
                'modules' => Module::query()->whereIn('class_id', $classIds)->count(),
                'pendingAssessments' => Classroom::query()->whereIn('id', $classIds)
                    ->whereDoesntHave('assessment')->count(),
                'schedules' => ScheduleEvent::query()->whereIn('class_id', $classIds)->count(),
            ]]);
        }

        $classIds = $user->classes()->pluck('classes.id');
        $moduleIds = Module::query()->whereIn('class_id', $classIds)->pluck('id');
        $scores = AssessmentAttempt::query()->where('student_id', $user->id);
        $nextEvent = ScheduleEvent::query()
            ->with('classroom')
            ->where('starts_at', '>=', now())
            ->where(fn ($events) => $events->whereNull('class_id')->orWhereIn('class_id', $classIds))
            ->orderBy('starts_at')
            ->first();

        return response()->json(['dashboard' => [
            'classes' => $classIds->count(),
            'modules' => Module::query()->whereIn('id', $moduleIds)->count(),
            'completedModules' => ModuleProgress::query()
                ->where('user_id', $user->id)
                ->whereIn('module_id', $moduleIds)
                ->where('status', 'completed')
                ->count(),
            'averageQuizScore' => round((float) $scores->avg('score')),
            'quizAttempts' => $scores->count(),
            'upcomingSchedule' => $nextEvent ? [
                'title' => $nextEvent->title,
                'className' => $nextEvent->classroom?->name,
                'startsAt' => $nextEvent->starts_at?->toISOString(),
                'joinUrl' => $nextEvent->join_url,
            ] : null,
        ]]);
    }
}

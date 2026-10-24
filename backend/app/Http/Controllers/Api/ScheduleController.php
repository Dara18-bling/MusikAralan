<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classroom;
use App\Models\ScheduleEvent;
use App\Models\User;
use App\Notifications\AppMessageNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ScheduleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $query = ScheduleEvent::query()->with('classroom');

        if ($user->role === 'student') {
            $classIds = $user->classes()->pluck('classes.id');
            $query->where(fn ($events) => $events->whereNull('class_id')->orWhereIn('class_id', $classIds));
        } elseif ($user->role === 'teacher') {
            $query->where(fn ($events) => $events
                ->whereNull('class_id')
                ->orWhereHas('classroom', fn ($classes) => $classes->where('teacher_id', $user->id)));
        }

        return response()->json([
            'data' => $query->orderBy('starts_at')->limit(100)->get()->map(fn (ScheduleEvent $event): array => [
                'id' => (string) $event->id,
                'classId' => $event->class_id === null ? null : (string) $event->class_id,
                'className' => $event->classroom?->name,
                'title' => $event->title,
                'description' => $event->description,
                'startsAt' => $event->starts_at?->toISOString(),
                'joinUrl' => $event->join_url,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $creator = $request->attributes->get('app_user');
        abort_unless(in_array($creator->role, ['admin', 'teacher'], true), 403);
        $data = $request->validate([
            'classId' => [
                Rule::requiredIf($creator->role === 'teacher'),
                'nullable',
                'integer',
                'exists:classes,id',
            ],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'startsAt' => ['required', 'date'],
            'joinUrl' => ['nullable', 'url:https', 'max:2048'],
        ]);
        $class = isset($data['classId']) ? Classroom::query()->findOrFail($data['classId']) : null;
        if ($creator->role === 'teacher') {
            abort_unless($class && (int) $class->teacher_id === (int) $creator->id, 403);
        }

        $event = ScheduleEvent::query()->create([
            'class_id' => $class?->id,
            'created_by' => $creator->id,
            'title' => trim($data['title']),
            'description' => isset($data['description']) ? trim($data['description']) : null,
            'starts_at' => $data['startsAt'],
            'join_url' => $data['joinUrl'] ?? null,
        ]);
        $recipients = $class
            ? $class->students()->where('users.status', 'approved')->get()
            : User::query()->where('role', 'student')->where('status', 'approved')->get();

        foreach ($recipients as $recipient) {
            $recipient->notify(new AppMessageNotification(
                'schedule',
                $event->title,
                $event->description ?: 'A learning session has been scheduled.',
                classId: $class?->id,
            ));
        }

        return response()->json(['schedule' => [
            'id' => (string) $event->id,
            'classId' => $event->class_id === null ? null : (string) $event->class_id,
            'className' => $class?->name,
            'title' => $event->title,
            'description' => $event->description,
            'startsAt' => $event->starts_at?->toISOString(),
            'joinUrl' => $event->join_url,
        ]], 201);
    }
}

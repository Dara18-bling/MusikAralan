<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classroom;
use App\Models\Module;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClassController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $query = Classroom::query()->with('teacher')->withCount('students');

        if ($user->role === 'teacher') {
            $query->where('teacher_id', $user->id)->where('deleted', false);
        } elseif ($user->role === 'student') {
            $query->where('deleted', false);
        }

        $classes = $query->orderBy('name')->get()->map(fn (Classroom $class) => $this->payload($class, $user));

        return response()->json(['data' => $classes]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedClass($request);
        $class = Classroom::query()->create($this->classAttributes($data));
        $this->ensureModule($class);

        return response()->json(['class' => $this->payload($class->load('teacher')->loadCount('students'), $request->attributes->get('app_user'))], 201);
    }

    public function update(Request $request, Classroom $class): JsonResponse
    {
        $data = $this->validatedClass($request, true);
        $class->fill($this->classAttributes($data));
        if (array_key_exists('availableForEnrollment', $data) && $class->isDirty('available_for_enrollment')) {
            $class->enrollment_updated_at = now();
        }
        $class->save();
        $module = $class->modules()->first();
        if ($module) {
            $module->update([
                'title' => $class->name,
                'category' => $class->age_group,
                'description' => $class->description,
            ]);
        }

        return response()->json(['class' => $this->payload($class->load('teacher')->loadCount('students'), $request->attributes->get('app_user'))]);
    }

    public function enrollment(Request $request, Classroom $class): JsonResponse
    {
        $student = $request->attributes->get('app_user');
        if ($student->role !== 'student' || $class->deleted || ! $class->available_for_enrollment) {
            return response()->json(['message' => 'This class is not available for enrollment.'], 403);
        }

        $class->students()->syncWithoutDetaching([$student->id => ['enrolled_at' => now()]]);

        return response()->json(['enrolled' => true], 201);
    }

    public function students(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        if ($user->role === 'student') {
            abort_unless($class->students()->where('users.id', $user->id)->exists(), 403);
            $classmateCount = $class->students()
                ->where('users.status', 'approved')
                ->where('users.id', '!=', $user->id)
                ->count();

            return response()->json(['count' => $classmateCount]);
        } else {
            $this->ensureAssignedTeacher($request, $class);
        }
        $studentsQuery = $class->students()->where('users.status', 'approved');
        $students = $studentsQuery->orderBy('users.name')->get();

        $data = $students->map(function (User $student) use ($class): array {
            return [
                'id' => (string) $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'birthday' => $student->birthday?->format('Y-m-d'),
                'birthYear' => $student->birth_year,
                'status' => $student->status,
                'classProgress' => $this->studentProgress($student, $class),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function enrollmentNotice(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        if ($user->role === 'teacher') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json(['class' => $this->payload($class->load('teacher')->loadCount('students'), $user)]);
    }

    private function validatedClass(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'teacher' => ['sometimes', 'nullable', 'string', 'max:255'],
            'age' => ['sometimes', Rule::in(['all', 'kids', 'youth', 'adults'])],
            'description' => ['sometimes', 'nullable', 'string'],
            'availableForEnrollment' => ['sometimes', 'boolean'],
            'deleted' => ['sometimes', 'boolean'],
        ]);
    }

    private function classAttributes(array $data): array
    {
        $attributes = [];
        foreach ([
            'name' => 'name',
            'age' => 'age_group',
            'description' => 'description',
            'availableForEnrollment' => 'available_for_enrollment',
            'deleted' => 'deleted',
        ] as $input => $column) {
            if (array_key_exists($input, $data)) {
                $attributes[$column] = $data[$input];
            }
        }
        if (array_key_exists('teacher', $data)) {
            $name = trim((string) $data['teacher']);
            $attributes['teacher_id'] = $name === '' || strtolower($name) === 'unassigned'
                ? null
                : User::query()->where('role', 'teacher')->where('status', 'approved')->where('name', $name)->value('id');
            if ($name !== '' && strtolower($name) !== 'unassigned' && ! $attributes['teacher_id']) {
                abort(422, 'The selected teacher account was not found or is not approved.');
            }
        }

        return $attributes;
    }

    private function payload(Classroom $class, User $user): array
    {
        $studentIds = $user->role === 'admin' || $user->role === 'teacher'
            ? $class->students()->pluck('users.id')->map(fn ($id) => (string) $id)->all()
            : ($class->students()->where('users.id', $user->id)->exists() ? [(string) $user->id] : []);

        return [
            'id' => (string) $class->id,
            'name' => $class->name,
            'teacher' => $class->teacher?->name ?? 'Unassigned',
            'teacherId' => $class->teacher ? (string) $class->teacher->id : null,
            'age' => $class->age_group,
            'description' => $class->description ?? '',
            'availableForEnrollment' => $class->available_for_enrollment,
            'deleted' => $class->deleted,
            'enrolledStudentIds' => $studentIds,
            'enrolledCount' => $class->students_count ?? $class->students()->count(),
            'createdAt' => $class->created_at?->toISOString(),
            'enrollmentUpdatedAt' => $class->enrollment_updated_at?->toISOString(),
        ];
    }

    private function ensureModule(Classroom $class): Module
    {
        return $class->modules()->first() ?? $class->modules()->create([
            'title' => $class->name,
            'category' => $class->age_group,
            'description' => $class->description,
            'created_by' => $class->teacher_id,
        ]);
    }

    private function ensureAssignedTeacher(Request $request, Classroom $class): void
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'admin' || ($user->role === 'teacher' && $class->teacher_id === $user->id), 403);
    }

    private function studentProgress(User $student, Classroom $class): array
    {
        $completed = DB::table('material_completions')
            ->join('materials', 'materials.id', '=', 'material_completions.material_id')
            ->where('material_completions.student_id', $student->id)
            ->where('materials.class_id', $class->id)
            ->pluck('material_completions.material_id')
            ->map(fn ($id) => (string) $id)
            ->all();
        $attempt = DB::table('assessment_attempts')
            ->join('assessments', 'assessments.id', '=', 'assessment_attempts.assessment_id')
            ->where('assessment_attempts.student_id', $student->id)
            ->where('assessments.class_id', $class->id)
            ->orderByDesc('assessment_attempts.submitted_at')
            ->first();

        return [
            'completedMaterialIds' => $completed,
            'assessmentScore' => $attempt?->score,
            'assessmentPassed' => (bool) ($attempt?->passed ?? false),
        ];
    }
}

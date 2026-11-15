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
    private const STUDENTS_PER_PAGE = 10;

    private const SOFT_CLASS_LIMIT = 3;

    private const HARD_CLASS_LIMIT = 5;

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
        $result = DB::transaction(function () use ($data, $request): JsonResponse {
            $attributes = $this->classAttributes($data);
            $teacherId = $attributes['teacher_id'] ?? null;
            if ($teacherId !== null && ! ($attributes['deleted'] ?? false)) {
                $teacher = User::query()->whereKey($teacherId)->lockForUpdate()->firstOrFail();
                $loadResponse = $this->teacherLoadResponse(
                    $teacher,
                    null,
                    (bool) ($data['confirmOverload'] ?? false),
                );
                if ($loadResponse) {
                    return $loadResponse;
                }
            }

            $class = Classroom::query()->create($attributes);
            $this->ensureModule($class);

            return response()->json([
                'class' => $this->payload(
                    $class->load('teacher')->loadCount('students'),
                    $request->attributes->get('app_user'),
                ),
            ], 201);
        });

        return $result;
    }

    public function update(Request $request, Classroom $class): JsonResponse
    {
        $data = $this->validatedClass($request, true);

        return DB::transaction(function () use ($data, $request, $class): JsonResponse {
            $class = Classroom::query()->whereKey($class->id)->lockForUpdate()->firstOrFail();
            $attributes = $this->classAttributes($data);
            $targetTeacherId = array_key_exists('teacher_id', $attributes)
                ? $attributes['teacher_id']
                : $class->teacher_id;
            $targetDeleted = $attributes['deleted'] ?? $class->deleted;
            $becomesActiveAssignment = $targetTeacherId !== null
                && ! $targetDeleted
                && ((int) $targetTeacherId !== (int) $class->teacher_id || $class->deleted);

            if ($becomesActiveAssignment) {
                $teacher = User::query()->whereKey($targetTeacherId)->lockForUpdate()->firstOrFail();
                $loadResponse = $this->teacherLoadResponse(
                    $teacher,
                    $class->id,
                    (bool) ($data['confirmOverload'] ?? false),
                );
                if ($loadResponse) {
                    return $loadResponse;
                }
            }

            $class->fill($attributes);
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

            return response()->json([
                'class' => $this->payload(
                    $class->load('teacher')->loadCount('students'),
                    $request->attributes->get('app_user'),
                ),
            ]);
        });
    }

    public function updateCertificateAccess(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'teacher' && (int) $class->teacher_id === (int) $user->id, 403);

        $data = $request->validate([
            'certificatesUnlocked' => ['required', 'boolean'],
        ]);
        $class->certificates_unlocked = $data['certificatesUnlocked'];
        $class->save();

        return response()->json([
            'class' => $this->payload(
                $class->load('teacher')->loadCount('students'),
                $user,
            ),
        ]);
    }

    public function enrollment(Request $request, Classroom $class): JsonResponse
    {
        $student = $request->attributes->get('app_user');
        if ($student->role !== 'student' || $class->deleted || ! $class->available_for_enrollment) {
            return response()->json(['message' => 'This class is not available for enrollment.'], 403);
        }

        $data = $request->validate([
            'confirmOverload' => ['sometimes', 'boolean'],
        ]);

        return DB::transaction(function () use ($class, $student, $data): JsonResponse {
            $student = User::query()->whereKey($student->id)->lockForUpdate()->firstOrFail();
            $alreadyEnrolled = $class->students()->where('users.id', $student->id)->exists();
            if ($alreadyEnrolled) {
                return response()->json(['enrolled' => true, 'alreadyEnrolled' => true]);
            }

            $enrolledCount = $student->classes()->where('classes.deleted', false)->count();
            if ($enrolledCount >= self::HARD_CLASS_LIMIT) {
                return response()->json([
                    'code' => 'class_load_hard_limit',
                    'message' => 'You are already enrolled in the maximum of 5 active classes.',
                ], 422);
            }
            if (
                $enrolledCount >= self::SOFT_CLASS_LIMIT
                && ! ($data['confirmOverload'] ?? false)
            ) {
                return response()->json([
                    'code' => 'class_load_warning',
                    'message' => "You are enrolled in {$enrolledCount} active classes. Enrolling in another will exceed the recommended limit of 3.",
                    'enrolledCount' => $enrolledCount,
                ], 409);
            }

            $class->students()->syncWithoutDetaching([$student->id => ['enrolled_at' => now()]]);

            return response()->json([
                'enrolled' => true,
                'enrolledCount' => $enrolledCount + 1,
            ], 201);
        });
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
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $studentsQuery = $class->students()->where('users.status', 'approved');
        $students = $studentsQuery->orderBy('users.name')->orderBy('users.id')->paginate(
            self::STUDENTS_PER_PAGE,
            ['users.*'],
            'page',
            $validated['page'] ?? 1,
        );
        $studentIds = $students->getCollection()->modelKeys();

        $completedMaterials = collect();
        $deletedCompletedMaterials = collect();
        $latestAttempts = collect();
        if ($studentIds !== []) {
            $completedMaterials = DB::table('material_completions')
                ->join('materials', 'materials.id', '=', 'material_completions.material_id')
                ->whereIn('material_completions.student_id', $studentIds)
                ->where('materials.class_id', $class->id)
                ->whereNull('materials.deleted_at')
                ->get([
                    'material_completions.student_id',
                    'material_completions.material_id',
                ])
                ->groupBy('student_id');

            $deletedCompletedMaterials = DB::table('material_completions')
                ->join('materials', 'materials.id', '=', 'material_completions.material_id')
                ->whereIn('material_completions.student_id', $studentIds)
                ->where('materials.class_id', $class->id)
                ->whereNotNull('materials.deleted_at')
                ->orderBy('material_completions.completed_at')
                ->get([
                    'material_completions.student_id',
                    'materials.id',
                    'materials.title',
                    'material_completions.completed_at',
                ])
                ->groupBy('student_id');

            $latestAttemptsByStudent = DB::table('assessment_attempts')
                ->join('assessments', 'assessments.id', '=', 'assessment_attempts.assessment_id')
                ->where('assessments.class_id', $class->id)
                ->whereIn('assessment_attempts.student_id', $studentIds)
                ->select('assessment_attempts.student_id')
                ->selectRaw('MAX(assessment_attempts.submitted_at) as latest_submitted_at')
                ->groupBy('assessment_attempts.student_id');

            $latestAttempts = DB::table('assessment_attempts')
                ->joinSub($latestAttemptsByStudent, 'latest_attempts', function ($join): void {
                    $join->on(
                        'assessment_attempts.student_id',
                        '=',
                        'latest_attempts.student_id',
                    )->on(
                        'assessment_attempts.submitted_at',
                        '=',
                        'latest_attempts.latest_submitted_at',
                    );
                })
                ->join('assessments', 'assessments.id', '=', 'assessment_attempts.assessment_id')
                ->where('assessments.class_id', $class->id)
                ->orderByDesc('assessment_attempts.id')
                ->get([
                    'assessment_attempts.student_id',
                    'assessment_attempts.score',
                    'assessment_attempts.passed',
                ])
                ->unique('student_id')
                ->keyBy('student_id');
        }

        $data = $students->getCollection()->map(function (User $student) use (
            $completedMaterials,
            $deletedCompletedMaterials,
            $latestAttempts,
        ): array {
            $attempt = $latestAttempts->get($student->id);

            return [
                'id' => (string) $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'birthday' => $student->birthday?->format('Y-m-d'),
                'birthYear' => $student->birth_year,
                'status' => $student->status,
                'classProgress' => [
                    'completedMaterialIds' => $completedMaterials
                        ->get($student->id, collect())
                        ->pluck('material_id')
                        ->map(fn ($id) => (string) $id)
                        ->all(),
                    'deletedCompletedMaterials' => $deletedCompletedMaterials
                        ->get($student->id, collect())
                        ->map(fn ($material) => [
                            'id' => (string) $material->id,
                            'title' => $material->title,
                            'completedAt' => $material->completed_at,
                        ])
                        ->all(),
                    'assessmentScore' => $attempt?->score,
                    'assessmentPassed' => (bool) ($attempt?->passed ?? false),
                ],
            ];
        });

        return response()->json([
            'data' => $data,
            'currentPage' => $students->currentPage(),
            'lastPage' => $students->lastPage(),
            'perPage' => $students->perPage(),
            'total' => $students->total(),
            'from' => $students->firstItem(),
            'to' => $students->lastItem(),
        ]);
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
            'confirmOverload' => ['sometimes', 'boolean'],
        ]);
    }

    private function teacherLoadResponse(User $teacher, ?int $excludeClassId, bool $confirmed): ?JsonResponse
    {
        $query = Classroom::query()
            ->where('teacher_id', $teacher->id)
            ->where('deleted', false);
        if ($excludeClassId !== null) {
            $query->where('id', '<>', $excludeClassId);
        }
        $classCount = $query->count();

        if ($classCount >= self::HARD_CLASS_LIMIT) {
            return response()->json([
                'code' => 'class_load_hard_limit',
                'message' => 'This teacher already manages the maximum of 5 active classes.',
            ], 422);
        }
        if ($classCount >= self::SOFT_CLASS_LIMIT && ! $confirmed) {
            return response()->json([
                'code' => 'class_load_warning',
                'message' => "This teacher already manages {$classCount} active classes. Assigning another will exceed the recommended limit of 3.",
                'classCount' => $classCount,
            ], 409);
        }

        return null;
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
            'certificatesUnlocked' => $class->certificates_unlocked,
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

}

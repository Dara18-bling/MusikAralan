<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Assessment;
use App\Models\AssessmentQuestion;
use App\Models\AssignmentSubmission;
use App\Models\Classroom;
use App\Models\Material;
use App\Models\Module;
use App\Models\ModuleProgress;
use App\Models\QuizAttempt;
use App\Models\User;
use App\Support\RealtimeUpdates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class LearningController extends Controller
{
    public function materials(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $this->ensureClassAccess($user, $class);
        $materials = $class->materials()->with('classroom');
        if ($user->role === 'student') {
            $materials->with(['submissions' => fn ($query) => $query->where('student_id', $user->id)]);
        }
        $items = $materials->orderByDesc('created_at')->get()
            ->map(fn (Material $material) => $this->materialPayload($material, $user));

        return response()->json([
            'data' => $items,
            'maxUploadSizeMb' => $this->maxUploadSizeMb(),
        ]);
    }

    public function createMaterial(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'admin' || ($user->role === 'teacher' && $class->teacher_id === $user->id), 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'kind' => ['required', 'string', 'max:32'],
            'mediaUrl' => ['nullable', 'string', 'max:'.($this->maxUploadSizeMb() * 1398102 + 4096)],
            'streamUrl' => ['nullable', 'string', 'max:'.($this->maxUploadSizeMb() * 1398102 + 4096)],
            'file' => ['nullable', 'file', 'max:'.($this->maxUploadSizeMb() * 1024), 'mimes:pdf,doc,docx,odt,ppt,pptx,xls,xlsx,csv,txt,rtf,jpg,jpeg,png,gif,webp,mp3,wav,m4a,aac,ogg,mp4,mov,webm'],
            'isAssignment' => ['sometimes', 'boolean'],
            'availableFrom' => ['nullable', 'required_if:isAssignment,true', 'date'],
            'dueAt' => ['nullable', 'required_if:isAssignment,true', 'date', 'after_or_equal:availableFrom'],
            'allowLateSubmissions' => ['sometimes', 'boolean'],
            'maxPoints' => ['sometimes', 'required_if:isAssignment,true', 'integer', 'min:1', 'max:10000'],
        ]);
        if (($data['isAssignment'] ?? false) && empty($data['availableFrom'])) {
            return response()->json(['message' => 'Set a start date and end date for this assignment.'], 422);
        }

        $mediaUrl = $data['mediaUrl'] ?? null;
        $streamUrl = $data['streamUrl'] ?? null;
        foreach ([$mediaUrl, $streamUrl] as $url) {
            if (is_string($url) && $url !== '' && ! str_starts_with($url, 'data:') && ! $this->isSafeExternalUrl($url)) {
                return response()->json(['message' => 'Media links must use a valid HTTPS URL.'], 422);
            }
        }
        $storagePath = null;
        if ($request->hasFile('file')) {
            if ($mediaUrl || $streamUrl) {
                return response()->json(['message' => 'Submit either a file or a link, not both.'], 422);
            }
            $storagePath = $this->storeUploadedMaterial($request->file('file'));
            $mediaUrl = Storage::disk(config('filesystems.material_uploads_disk', 'public'))->url($storagePath);
            $streamUrl = $mediaUrl;
        }
        if ($storagePath === null) {
            foreach (['mediaUrl' => &$mediaUrl, 'streamUrl' => &$streamUrl] as &$candidate) {
                if (is_string($candidate) && str_starts_with($candidate, 'data:')) {
                    if ($storagePath !== null) {
                        $candidate = Storage::disk(config('filesystems.material_uploads_disk', 'public'))->url($storagePath);

                        continue;
                    }
                    $storagePath = $this->storeDataUrl($candidate);
                    $candidate = Storage::disk(config('filesystems.material_uploads_disk', 'public'))->url($storagePath);
                }
            }
            unset($candidate);
        }

        $module = $this->moduleForClass($class);
        $material = $class->materials()->create([
            'module_id' => $module->id,
            'teacher_id' => $user->id,
            'title' => trim($data['title']),
            'description' => trim($data['description']),
            'kind' => $data['kind'],
            'media_url' => $mediaUrl,
            'stream_url' => $streamUrl,
            'storage_path' => $storagePath,
            'is_assignment' => $data['isAssignment'] ?? false,
            'available_from' => $data['availableFrom'] ?? null,
            'due_at' => $data['dueAt'] ?? null,
            'allow_late_submissions' => $data['allowLateSubmissions'] ?? false,
            'max_points' => $data['maxPoints'] ?? 100,
        ]);
        $this->broadcastClassChange($class->id, ['/classes/{classId}/materials', '/classes/{classId}/students']);

        return response()->json(['material' => $this->materialPayload($material, $user)], 201);
    }

    public function updateMaterial(Request $request, Classroom $class, string $material): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'admin' || ($user->role === 'teacher' && (int) $class->teacher_id === (int) $user->id), 403);
        $item = $class->materials()->findOrFail($material);
        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'required', 'string'],
            'isAssignment' => ['sometimes', 'boolean'],
            'availableFrom' => ['nullable', 'required_if:isAssignment,true', 'date'],
            'dueAt' => ['nullable', 'required_if:isAssignment,true', 'date', 'after_or_equal:availableFrom'],
            'allowLateSubmissions' => ['sometimes', 'boolean'],
            'maxPoints' => ['sometimes', 'required_if:isAssignment,true', 'integer', 'min:1', 'max:10000'],
        ]);
        $isAssignment = $data['isAssignment'] ?? $item->is_assignment;
        if ($isAssignment && (empty($data['availableFrom']) && ! $item->available_from
            || empty($data['dueAt']) && ! $item->due_at)) {
            return response()->json(['message' => 'Set a start date and end date for this assignment.'], 422);
        }
        $item->fill([
            'title' => $data['title'] ?? $item->title,
            'description' => $data['description'] ?? $item->description,
            'is_assignment' => $isAssignment,
            'available_from' => $data['availableFrom'] ?? $item->available_from,
            'due_at' => $data['dueAt'] ?? $item->due_at,
            'allow_late_submissions' => $data['allowLateSubmissions'] ?? $item->allow_late_submissions,
            'max_points' => $data['maxPoints'] ?? $item->max_points,
        ])->save();
        $this->broadcastClassChange($class->id, ['/classes/{classId}/materials', '/classes/{classId}/students']);

        return response()->json(['material' => $this->materialPayload($item->fresh(), $user)]);
    }

    public function deleteMaterial(Request $request, Classroom $class, string $material): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless(
            $user->role === 'teacher' && (int) $class->teacher_id === (int) $user->id,
            403,
        );

        $item = $class->materials()->withTrashed()->findOrFail($material);
        abort_unless((int) $item->teacher_id === (int) $user->id, 403);

        $fileDeleted = false;
        if (is_string($item->storage_path) && $item->storage_path !== '') {
            $pathInUse = Material::query()
                ->where('storage_path', $item->storage_path)
                ->where('id', '<>', $item->id)
                ->exists();
            if (! $pathInUse) {
                $diskName = config('filesystems.material_uploads_disk', 'public');
                try {
                    $fileDeleted = Storage::disk($diskName)->delete($item->storage_path);
                } catch (\Throwable $exception) {
                    Log::error('Could not delete soft-deleted class material file.', [
                        'disk' => $diskName,
                        'material_id' => $item->id,
                        'path' => $item->storage_path,
                        'exception' => $exception::class,
                        'reason' => $exception->getMessage(),
                    ]);

                    return response()->json(['message' => 'The file could not be removed from storage. The material was not deleted.'], 500);
                }
                if (! $fileDeleted) {
                    Log::error('Could not delete soft-deleted class material file; storage disk returned false.', [
                        'disk' => $diskName,
                        'material_id' => $item->id,
                        'path' => $item->storage_path,
                    ]);

                    return response()->json(['message' => 'The file could not be removed from storage. The material was not deleted.'], 500);
                }
            }
        }

        if (! $item->trashed() && ! $item->delete()) {
            Log::error('Could not soft-delete class material after deleting its stored file.', [
                'material_id' => $item->id,
            ]);

            return response()->json([
                'message' => 'The file was removed, but the material record could not be deleted. Please retry.',
            ], 500);
        }
        $this->broadcastClassChange(
            $class->id,
            ['/classes/{classId}/materials', '/classes/{classId}/progress', '/classes/{classId}/students'],
        );

        return response()->json([
            'deleted' => true,
            'fileDeleted' => $fileDeleted,
        ]);
    }

    public function assessment(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $this->ensureClassAccess($user, $class);
        $assessment = $class->assessments()->with('questions')->orderBy('id')->first();

        return response()->json([
            'assessment' => $assessment ? $this->assessmentPayload($assessment, $user->role !== 'student') : null,
        ]);
    }

    public function assessments(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $this->ensureClassAccess($user, $class);
        $assessments = $class->assessments()->withCount('questions')->orderBy('id')->get();

        return response()->json([
            'data' => $assessments->map(function (Assessment $assessment) use ($user): array {
                $attempts = $user->role === 'student'
                    ? $assessment->attempts()
                        ->where('student_id', $user->id)
                        ->latest('submitted_at')
                        ->orderByDesc('id')
                        ->limit(10)
                        ->get()
                    : collect();
                $latestAttempt = $attempts->first();

                return [
                    'id' => (string) $assessment->id,
                    'assessmentCode' => $assessment->assessment_code,
                    'title' => $assessment->title,
                    'passingPercent' => $assessment->passing_percent,
                    'questionCount' => $assessment->questions_count,
                    'allowsRetakes' => $assessment->allows_retakes,
                    'latestAttempt' => $latestAttempt ? [
                        'score' => $latestAttempt->score,
                        'passed' => $latestAttempt->passed,
                        'submittedAt' => $latestAttempt->submitted_at?->toISOString(),
                    ] : null,
                    'recentAttempts' => $attempts->map(fn (QuizAttempt $attempt): array => [
                        'id' => (string) $attempt->id,
                        'score' => $attempt->score,
                        'passed' => $attempt->passed,
                        'submittedAt' => $attempt->submitted_at?->toISOString(),
                    ])->values(),
                ];
            })->values(),
        ]);
    }

    public function showAssessment(Request $request, Assessment $assessment): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $this->ensureClassAccess($user, $assessment->classroom);

        return response()->json([
            'assessment' => $this->assessmentPayload(
                $assessment->load('questions'),
                $user->role !== 'student',
            ),
        ]);
    }

    public function publishAssessment(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'admin' || ($user->role === 'teacher' && $class->teacher_id === $user->id), 403);
        $assessment = $class->assessments()->orderBy('id')->first();

        return $this->saveAssessment($request, $class, $user, $assessment);
    }

    public function createAssessment(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'admin' || ($user->role === 'teacher' && $class->teacher_id === $user->id), 403);

        return $this->saveAssessment($request, $class, $user);
    }

    public function updateAssessment(Request $request, Assessment $assessment): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $class = $assessment->classroom;
        abort_unless($user->role === 'admin' || ($user->role === 'teacher' && $class->teacher_id === $user->id), 403);

        return $this->saveAssessment($request, $class, $user, $assessment);
    }

    private function saveAssessment(Request $request, Classroom $class, $user, ?Assessment $assessment = null): JsonResponse
    {
        $isNew = $assessment === null;
        $assessmentCodeRule = Rule::unique('assessments', 'assessment_code')
            ->where('class_id', $class->id);
        if ($assessment !== null) {
            $assessmentCodeRule->ignore($assessment->id);
        }
        $data = $request->validate([
            'assessmentCode' => [
                'nullable',
                'string',
                'max:32',
                $assessmentCodeRule,
            ],
            'title' => ['required', 'string', 'max:255'],
            'passingPercent' => ['required', 'integer', 'between:0,100'],
            'allowsRetakes' => ['sometimes', 'boolean'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.q' => ['required', 'string'],
            'questions.*.type' => ['required', Rule::in(['multiple', 'truefalse', 'identification'])],
            'questions.*.o' => ['nullable', 'array'],
            'questions.*.o.*' => ['string'],
            'questions.*.a' => ['nullable', 'integer', 'min:0'],
            'questions.*.answer' => ['nullable', 'string'],
        ]);

        foreach ($data['questions'] as $question) {
            if ($question['type'] === 'identification' && trim($question['answer'] ?? '') === '') {
                return response()->json(['message' => 'Every identification question needs a correct answer.'], 422);
            }
            if ($question['type'] !== 'identification' && (! isset($question['a']) || $question['a'] >= count($question['o'] ?? []))) {
                return response()->json(['message' => 'Every choice question needs a valid correct option.'], 422);
            }
        }

        $assessment = DB::transaction(function () use ($class, $data, $user, $assessment): Assessment {
            $module = $this->moduleForClass($class, $user->id);
            if ($assessment === null) {
                $assessment = new Assessment([
                    'assessment_code' => $data['assessmentCode'] ?? $this->nextAssessmentCode($class),
                ]);
                $assessment->classroom()->associate($class);
            } elseif (isset($data['assessmentCode'])) {
                $assessment->assessment_code = $data['assessmentCode'];
            }
            $assessment->module()->associate($module);
            $assessment->title = $data['title'];
            $assessment->passing_percent = $data['passingPercent'];
            $assessment->allows_retakes = $data['allowsRetakes'] ?? true;
            $assessment->save();
            $assessment->questions()->delete();
            foreach (array_values($data['questions']) as $position => $question) {
                $assessment->questions()->create([
                    'position' => $position,
                    'prompt' => $question['q'],
                    'type' => $question['type'],
                    'options' => $question['o'] ?? null,
                    'correct_option_index' => $question['type'] === 'identification' ? null : $question['a'],
                    'correct_answer' => $question['answer'] ?? null,
                ]);
            }

            return $assessment->load('questions');
        });
        $this->broadcastClassChange($class->id, ['/classes/{classId}/assessments']);

        return response()->json(
            ['assessment' => $this->assessmentPayload($assessment, true)],
            $isNew ? 201 : 200,
        );
    }

    private function nextAssessmentCode(Classroom $class): string
    {
        $nextNumber = (int) $class->assessments()
            ->get()
            ->map(fn (Assessment $assessment) => (int) preg_replace('/\D+/', '', $assessment->assessment_code))
            ->max() + 1;

        return 'A'.$nextNumber;
    }

    public function submitAssessment(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'student', 403);
        abort_unless($class->students()->where('users.id', $user->id)->exists(), 403, 'Enroll in this class before submitting an assessment.');
        $assessment = $class->assessments()->orderBy('id')->firstOrFail();

        return $this->gradeAssessment($request, $assessment, $user);
    }

    public function submitAssessmentAttempt(Request $request, Assessment $assessment): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'student', 403);
        abort_unless(
            $assessment->classroom->students()->where('users.id', $user->id)->exists(),
            403,
            'Enroll in this class before submitting an assessment.',
        );

        return $this->gradeAssessment($request, $assessment, $user);
    }

    private function gradeAssessment(Request $request, Assessment $assessment, $user): JsonResponse
    {
        abort_if(
            ! $assessment->allows_retakes
                && $assessment->attempts()->where('student_id', $user->id)->exists(),
            403,
            'This assessment does not allow retakes.',
        );
        $data = $request->validate(['answers' => ['required', 'array', 'min:1']]);
        $assessment->load('questions', 'classroom');
        $class = $assessment->classroom;
        $questions = $assessment->questions;
        if (count($data['answers']) !== $questions->count()) {
            return response()->json(['message' => 'Answer every question before submitting.'], 422);
        }

        $normalizedAnswers = [];
        foreach ($questions as $index => $question) {
            if (! array_key_exists($index, $data['answers']) || ! is_scalar($data['answers'][$index])) {
                return response()->json(['message' => 'Answer every question before submitting.'], 422);
            }
            $normalizedAnswers[$question->id] = (string) $data['answers'][$index];
        }

        $correctCount = $questions->filter(
            fn (AssessmentQuestion $question) => $this->isCorrectAnswer($question, $normalizedAnswers[$question->id]),
        )->count();
        $score = (int) round(($correctCount / max($questions->count(), 1)) * 100);
        $passed = $score >= $assessment->passing_percent;
        $module = $assessment->module ?? $this->moduleForClass($class);
        if ($assessment->module_id !== $module->id) {
            $assessment->module()->associate($module);
            $assessment->save();
        }

        $attempt = DB::transaction(function () use ($assessment, $module, $user, $questions, $normalizedAnswers, $score, $passed): QuizAttempt {
            $progress = ModuleProgress::query()->firstOrCreate(
                ['user_id' => $user->id, 'module_id' => $module->id],
                ['status' => 'in_progress'],
            );
            $attempt = QuizAttempt::query()->create([
                'assessment_id' => $assessment->id,
                'student_id' => $user->id,
                'module_progress_id' => $progress->id,
                'score' => $score,
                'passed' => $passed,
                'status' => $passed ? 'passed' : 'failed',
                'submitted_at' => now(),
            ]);
            foreach ($questions as $question) {
                $answer = $normalizedAnswers[$question->id];
                $attempt->answers()->create([
                    'question_id' => $question->id,
                    'answer' => $answer,
                    'correct' => $this->isCorrectAnswer($question, $answer),
                ]);
            }

            $this->refreshModuleProgress($progress);

            return $attempt;
        });
        $this->broadcastClassChange(
            $class->id,
            [
                '/classes/{classId}/assessments',
                '/classes/{classId}/progress',
                '/classes/{classId}/students',
                '/quiz-attempts',
            ],
            (int) $user->id,
        );

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'score' => $score,
                'passed' => $passed,
                'submittedAt' => $attempt->submitted_at?->toISOString(),
            ],
        ], 201);
    }

    public function progress(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'student' && $class->students()->where('users.id', $user->id)->exists(), 403);
        $completed = DB::table('material_completions')
            ->join('materials', 'materials.id', '=', 'material_completions.material_id')
            ->where('material_completions.student_id', $user->id)
            ->where('materials.class_id', $class->id)
            ->whereNull('materials.deleted_at')
            ->pluck('material_completions.material_id')
            ->map(fn ($id) => (string) $id)
            ->all();
        $deletedCompletedMaterials = DB::table('material_completions')
            ->join('materials', 'materials.id', '=', 'material_completions.material_id')
            ->where('material_completions.student_id', $user->id)
            ->where('materials.class_id', $class->id)
            ->whereNotNull('materials.deleted_at')
            ->orderBy('material_completions.completed_at')
            ->get([
                'materials.id',
                'materials.title',
                'material_completions.completed_at',
            ])
            ->map(fn ($material) => [
                'id' => (string) $material->id,
                'title' => $material->title,
                'completedAt' => $material->completed_at,
            ])
            ->all();
        $attempt = DB::table('assessment_attempts')
            ->join('assessments', 'assessments.id', '=', 'assessment_attempts.assessment_id')
            ->where('assessment_attempts.student_id', $user->id)
            ->where('assessments.class_id', $class->id)
            ->orderByDesc('assessment_attempts.submitted_at')
            ->first();

        $module = $class->modules()->first();

        return response()->json(['progress' => [
            'completedMaterialIds' => $completed,
            'deletedCompletedMaterials' => $deletedCompletedMaterials,
            'assessmentScore' => $attempt?->score,
            'assessmentPassed' => (bool) ($attempt?->passed ?? false),
            'moduleProgress' => $module
                ? ModuleProgress::query()->where('user_id', $user->id)->where('module_id', $module->id)->value('status') ?? 'not_started'
                : 'not_started',
        ]]);
    }

    public function completeMaterial(Request $request, Classroom $class, Material $material): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless(
            $user->role === 'student'
                && (int) $material->class_id === (int) $class->id
                && ! $material->trashed()
                && $class->students()->where('users.id', $user->id)->exists(),
            403,
        );
        DB::table('material_completions')->updateOrInsert(
            ['student_id' => $user->id, 'material_id' => $material->id],
            ['completed_at' => now()],
        );
        $this->broadcastClassChange(
            $class->id,
            ['/classes/{classId}/progress', '/classes/{classId}/students'],
            (int) $user->id,
        );

        return response()->json(['completed' => true]);
    }

    public function submitAssignment(Request $request, Classroom $class, Material $material): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless(
            $user->role === 'student'
                && (int) $material->class_id === (int) $class->id
                && ! $material->trashed()
                && $class->students()->where('users.id', $user->id)->exists(),
            403,
        );
        abort_unless($material->is_assignment, 404);
        abort_if(
            $material->available_from && now()->lt($material->available_from),
            403,
            'This assignment is not open yet.',
        );
        abort_if(
            $material->due_at && now()->gt($material->due_at) && ! $material->allow_late_submissions,
            403,
            'This assignment is closed to submissions.',
        );
        $data = $request->validate([
            'file' => ['required_without:driveUrl', 'file', 'max:'.($this->maxUploadSizeMb() * 1024), 'mimes:pdf,doc,docx,odt,ppt,pptx,xls,xlsx,csv,txt,rtf,jpg,jpeg,png,gif,webp,mp3,wav,m4a,aac,ogg,mp4,mov,webm'],
            'driveUrl' => ['required_without:file', 'nullable', 'url', 'max:2000'],
        ]);
        if (isset($data['file']) && isset($data['driveUrl'])) {
            return response()->json(['message' => 'Submit either a file or a Google link, not both.'], 422);
        }
        if (isset($data['driveUrl']) && ! $this->isGoogleUrl($data['driveUrl'])) {
            return response()->json(['message' => 'Submission links must be Google Drive, Docs, Sheets, or Slides links.'], 422);
        }

        $diskName = config('filesystems.material_uploads_disk', 'public');
        $newPath = null;
        $file = $request->file('file');
        if ($file) {
            try {
                $newPath = $file->store('assignment-submissions/'.$material->id, $diskName);
            } catch (\Throwable $exception) {
                Log::error('Could not save assignment submission.', [
                    'disk' => $diskName,
                    'material_id' => $material->id,
                    'student_id' => $user->id,
                    'exception' => $exception::class,
                    'reason' => $exception->getMessage(),
                ]);

                return response()->json(['message' => 'The submission file could not be saved. Please try again.'], 500);
            }
            if (! is_string($newPath) || $newPath === '') {
                Log::error('Could not save assignment submission; storage disk returned no path.', [
                    'disk' => $diskName,
                    'material_id' => $material->id,
                    'student_id' => $user->id,
                ]);

                return response()->json(['message' => 'The submission file could not be saved. Please try again.'], 500);
            }
        }

        $existing = $material->submissions()->where('student_id', $user->id)->first();
        $oldPath = $existing?->storage_path;
        try {
            $submission = DB::transaction(function () use ($material, $user, $file, $data, $newPath, $existing): AssignmentSubmission {
                $submission = $existing ?? new AssignmentSubmission([
                    'material_id' => $material->id,
                    'student_id' => $user->id,
                ]);
                $submission->fill([
                    'storage_path' => $newPath,
                    'file_name' => $file?->getClientOriginalName(),
                    'mime_type' => $file?->getMimeType(),
                    'file_size' => $file?->getSize(),
                    'drive_url' => $data['driveUrl'] ?? null,
                    'submitted_at' => now(),
                    'grade' => null,
                    'feedback' => null,
                    'graded_by' => null,
                    'graded_at' => null,
                ])->save();

                return $submission;
            });
        } catch (\Throwable $exception) {
            if ($newPath) {
                $this->deleteAssignmentUpload($diskName, $newPath, $material->id, $user->id);
            }
            Log::error('Could not record assignment submission.', [
                'material_id' => $material->id,
                'student_id' => $user->id,
                'exception' => $exception::class,
                'reason' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'The submission could not be recorded. Please try again.'], 500);
        }
        if ($oldPath && $oldPath !== $newPath) {
            $this->deleteAssignmentUpload($diskName, $oldPath, $material->id, $user->id);
        }
        $this->broadcastClassChange(
            $class->id,
            ['/classes/{classId}/students'],
            (int) $user->id,
        );

        return response()->json(['submission' => $this->submissionPayload($submission)], 201);
    }

    public function assignmentSubmissions(Request $request, Classroom $class, Material $material): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless(
            ($user->role === 'admin' || ($user->role === 'teacher' && (int) $class->teacher_id === (int) $user->id))
                && (int) $material->class_id === (int) $class->id
                && $material->is_assignment,
            403,
        );

        return response()->json([
            'data' => $material->submissions()->with('student:id,name,email')->orderByDesc('submitted_at')
                ->get()
                ->map(fn (AssignmentSubmission $submission): array => $this->submissionPayload($submission, true))
                ->values(),
        ]);
    }

    public function gradeAssignmentSubmission(
        Request $request,
        Classroom $class,
        Material $material,
        AssignmentSubmission $submission,
    ): JsonResponse {
        $user = $request->attributes->get('app_user');
        abort_unless(
            ($user->role === 'admin' || ($user->role === 'teacher' && (int) $class->teacher_id === (int) $user->id))
                && (int) $material->class_id === (int) $class->id
                && (int) $submission->material_id === (int) $material->id
                && $material->is_assignment,
            403,
        );
        $data = $request->validate([
            'grade' => ['required', 'integer', 'min:0', 'max:'.$material->max_points],
            'feedback' => ['nullable', 'string', 'max:5000'],
        ]);
        $submission->fill([
            'grade' => $data['grade'],
            'feedback' => $data['feedback'] ?? null,
            'graded_by' => $user->id,
            'graded_at' => now(),
        ])->save();
        $this->broadcastClassChange(
            $class->id,
            ['/classes/{classId}/students'],
            (int) $submission->student_id,
        );

        return response()->json(['submission' => $this->submissionPayload($submission->load('student:id,name,email'), true)]);
    }

    private function materialPayload(Material $material, ?User $user = null): array
    {
        $submission = $user?->role === 'student' ? $material->submissions->first() : null;

        return [
            'id' => (string) $material->id,
            'title' => $material->title,
            'description' => $material->description,
            'kind' => $material->kind,
            'mediaUrl' => $this->materialUrl($material->media_url, $material->storage_path),
            'streamUrl' => $this->materialUrl($material->stream_url, $material->storage_path),
            'teacherName' => $material->teacher?->name,
            'canDelete' => $user?->role === 'teacher'
                && (int) $material->teacher_id === (int) $user->id,
            'createdAt' => $material->created_at?->toISOString(),
            'isAssignment' => $material->is_assignment,
            'availableFrom' => $material->available_from?->toISOString(),
            'dueAt' => $material->due_at?->toISOString(),
            'allowLateSubmissions' => $material->allow_late_submissions,
            'maxPoints' => $material->max_points,
            'maxUploadSizeMb' => $this->maxUploadSizeMb(),
            'submission' => $submission ? $this->submissionPayload($submission) : null,
        ];
    }

    private function submissionPayload(AssignmentSubmission $submission, bool $includeStudent = false): array
    {
        $payload = [
            'id' => (string) $submission->id,
            'studentId' => (string) $submission->student_id,
            'fileName' => $submission->file_name,
            'fileUrl' => $submission->storage_path ? $this->storedFileUrl($submission->storage_path) : null,
            'driveUrl' => $submission->drive_url,
            'fileSize' => $submission->file_size,
            'submittedAt' => $submission->submitted_at?->toISOString(),
            'grade' => $submission->grade,
            'feedback' => $submission->feedback,
            'gradedAt' => $submission->graded_at?->toISOString(),
        ];
        if ($includeStudent) {
            $payload['studentName'] = $submission->student?->name;
            $payload['studentEmail'] = $submission->student?->email;
        }

        return $payload;
    }

    private function assessmentPayload(Assessment $assessment, bool $includeAnswers): array
    {
        return [
            'id' => (string) $assessment->id,
            'assessmentCode' => $assessment->assessment_code,
            'title' => $assessment->title,
            'passingPercent' => $assessment->passing_percent,
            'allowsRetakes' => $assessment->allows_retakes,
            'questions' => $assessment->questions->map(function (AssessmentQuestion $question) use ($includeAnswers): array {
                $payload = [
                    'id' => (string) $question->id,
                    'q' => $question->prompt,
                    'o' => $question->options ?? [],
                    'type' => $question->type,
                ];
                if ($includeAnswers) {
                    $payload['a'] = $question->correct_option_index;
                    $payload['answer'] = $question->correct_answer;
                }

                return $payload;
            })->values(),
        ];
    }

    /**
     * @param  array<int, string>  $topics
     */
    private function broadcastClassChange(int $classId, array $topics, ?int $userId = null): void
    {
        RealtimeUpdates::publish(
            array_values(array_unique([...$topics, '/dashboard'])),
            userIds: $userId === null ? [] : [$userId],
            roles: ['admin'],
            classIds: [$classId],
        );
    }

    private function ensureClassAccess($user, Classroom $class): void
    {
        if ($user->role === 'admin') {
            return;
        }
        if ($user->role === 'teacher' && $class->teacher_id === $user->id) {
            return;
        }
        abort_unless($user->role === 'student' && $class->students()->where('users.id', $user->id)->exists(), 403);
    }

    private function moduleForClass(Classroom $class, ?int $createdBy = null): Module
    {
        return $class->modules()->first() ?? $class->modules()->create([
            'title' => $class->name,
            'category' => $class->age_group,
            'description' => $class->description,
            'created_by' => $createdBy ?? $class->teacher_id,
        ]);
    }

    private function refreshModuleProgress(ModuleProgress $progress): void
    {
        $module = $progress->module()->with('assessments')->firstOrFail();
        $hasUnpassedQuiz = $module->assessments->contains(
            fn (Assessment $assessment) => ! $assessment->attempts()
                ->where('student_id', $progress->user_id)
                ->where('passed', true)
                ->exists(),
        );
        $hasRequiredPractice = $module->requires_practice
            && ! $progress->practiceSessions()->whereNotNull('completed_at')->exists();
        $hasRequiredQuiz = $module->assessments->isEmpty() || ! $hasUnpassedQuiz;
        $hasRequiredActivity = $module->assessments->isNotEmpty() || $module->requires_practice;
        $completed = $hasRequiredActivity && $hasRequiredQuiz && ! $hasRequiredPractice;

        $progress->forceFill([
            'status' => $completed ? 'completed' : 'in_progress',
            'completed_at' => $completed ? ($progress->completed_at ?? now()) : null,
        ])->save();
    }

    private function isCorrectAnswer(AssessmentQuestion $question, string $answer): bool
    {
        if ($question->type === 'identification') {
            return mb_strtolower(trim($answer)) === mb_strtolower(trim((string) $question->correct_answer));
        }

        $selectedOption = filter_var($answer, FILTER_VALIDATE_INT);

        return $selectedOption !== false && $selectedOption === $question->correct_option_index;
    }

    private function storeDataUrl(string $dataUrl): string
    {
        if (! preg_match('/^data:(?<mime>image\\/(?:png|jpe?g|gif|webp)|application\\/(?:pdf|vnd\\.[a-zA-Z0-9.+-]+)|audio\\/[a-zA-Z0-9.+-]+|video\\/[a-zA-Z0-9.+-]+|text\\/(?:csv|plain));base64,(?<data>[A-Za-z0-9+\\/=]+)$/', $dataUrl, $matches)) {
            abort(422, 'The uploaded media format is not supported.');
        }
        $contents = base64_decode($matches['data'], true);
        if ($contents === false || strlen($contents) > $this->maxUploadSizeMb() * 1024 * 1024) {
            abort(422, 'Uploaded media must be valid and no larger than '.$this->maxUploadSizeMb().' MB.');
        }
        $extension = match ($matches['mime']) {
            'application/pdf' => 'pdf',
            'text/csv' => 'csv',
            'text/plain' => 'txt',
            default => explode('/', $matches[1])[1],
        };
        $path = 'materials/'.now()->format('Y/m').'/'.bin2hex(random_bytes(16)).'.'.$extension;
        $diskName = config('filesystems.material_uploads_disk', 'public');
        try {
            $stored = Storage::disk($diskName)->put($path, $contents);
        } catch (\Throwable $exception) {
            Log::error('Could not save uploaded class material.', [
                'disk' => $diskName,
                'path' => $path,
                'exception' => $exception::class,
                'reason' => $exception->getMessage(),
            ]);

            abort(500, 'The uploaded media could not be saved. Check server logs for storage provider details.');
        }
        if (! $stored) {
            Log::error('Could not save uploaded class material; storage disk returned false.', [
                'disk' => $diskName,
                'path' => $path,
            ]);

            abort(500, 'The uploaded media could not be saved.');
        }

        return $path;
    }

    private function storeUploadedMaterial(UploadedFile $file): string
    {
        $diskName = config('filesystems.material_uploads_disk', 'public');
        try {
            $path = $file->store('materials/'.now()->format('Y/m'), $diskName);
        } catch (\Throwable $exception) {
            Log::error('Could not save uploaded class material.', [
                'disk' => $diskName,
                'exception' => $exception::class,
                'reason' => $exception->getMessage(),
            ]);

            abort(500, 'The uploaded media could not be saved. Check server logs for storage provider details.');
        }
        if (! is_string($path) || $path === '') {
            Log::error('Could not save uploaded class material; storage disk returned no path.', [
                'disk' => $diskName,
            ]);

            abort(500, 'The uploaded media could not be saved.');
        }

        return $path;
    }

    private function maxUploadSizeMb(): int
    {
        return max(1, (int) config('filesystems.material_upload_max_size_mb', 8));
    }

    private function materialUrl(?string $url, ?string $storagePath): ?string
    {
        if (is_string($url) && is_string($storagePath)) {
            $urlPath = parse_url($url, PHP_URL_PATH);
            if (
                is_string($urlPath)
                && str_ends_with(trim(rawurldecode($urlPath), '/'), ltrim($storagePath, '/'))
            ) {
                return $this->storedFileUrl($storagePath);
            }
        }

        return $this->safeStoredUrl($url);
    }

    private function storedFileUrl(string $storagePath): string
    {
        $disk = Storage::disk(config('filesystems.material_uploads_disk', 'public'));
        if (config('filesystems.material_uploads_signed_urls')) {
            $expiresInMinutes = min(
                1440,
                max(1, (int) config('filesystems.material_signed_url_ttl_minutes', 60)),
            );

            return $disk->temporaryUrl($storagePath, now()->addMinutes($expiresInMinutes));
        }

        return $disk->url($storagePath);
    }

    private function isGoogleUrl(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        return $this->isSafeExternalUrl($url)
            && ($host === 'google.com' || str_ends_with($host, '.google.com'));
    }

    private function deleteAssignmentUpload(string $diskName, string $path, int $materialId, int $studentId): void
    {
        try {
            if (! Storage::disk($diskName)->delete($path)) {
                Log::error('Could not remove replaced assignment submission file.', [
                    'disk' => $diskName,
                    'path' => $path,
                    'material_id' => $materialId,
                    'student_id' => $studentId,
                ]);
            }
        } catch (\Throwable $exception) {
            Log::error('Could not remove replaced assignment submission file.', [
                'disk' => $diskName,
                'path' => $path,
                'material_id' => $materialId,
                'student_id' => $studentId,
                'exception' => $exception::class,
                'reason' => $exception->getMessage(),
            ]);
        }
    }

    private function isSafeExternalUrl(string $url): bool
    {
        $parts = parse_url($url);

        return is_array($parts)
            && strtolower($parts['scheme'] ?? '') === 'https'
            && isset($parts['host'])
            && ! isset($parts['user'], $parts['pass']);
    }

    private function safeStoredUrl(?string $url): ?string
    {
        if (! is_string($url) || $url === '') {
            return null;
        }
        if ($this->isSafeExternalUrl($url)) {
            return $url;
        }
        $parts = parse_url($url);
        $applicationHost = parse_url((string) config('app.url'), PHP_URL_HOST);
        if (
            is_array($parts)
            && strtolower($parts['scheme'] ?? '') === 'http'
            && isset($parts['host'])
            && $parts['host'] === $applicationHost
            && in_array($parts['host'], ['localhost', '127.0.0.1'], true)
        ) {
            return $url;
        }

        return null;
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Jobs\ProcessSheetMusic;
use App\Http\Controllers\Controller;
use App\Models\Assessment;
use App\Models\AssessmentQuestion;
use App\Models\Classroom;
use App\Models\Material;
use App\Models\Module;
use App\Models\ModuleProgress;
use App\Models\QuizAttempt;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class LearningController extends Controller
{
    public function materialComments(Request $request, Classroom $class, string $material): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $this->ensureClassAccess($user, $class);
        $item = $class->materials()->findOrFail($material);

        return response()->json(['comments' => $this->privateComments($user, 'material_id', $item->id)]);
    }

    public function saveMaterialComment(Request $request, Classroom $class, string $material): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'student' && $class->students()->where('users.id', $user->id)->exists(), 403);
        $item = $class->materials()->findOrFail($material);
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);
        DB::table('student_private_comments')->updateOrInsert(
            ['student_id' => $user->id, 'material_id' => $item->id],
            ['assessment_id' => null, 'body' => trim($data['body']), 'created_at' => now(), 'updated_at' => now()],
        );

        return response()->json(['saved' => true]);
    }

    public function assessmentComments(Request $request, Classroom $class, string $assessment): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $this->ensureClassAccess($user, $class);
        $item = $class->assessments()->findOrFail($assessment);

        return response()->json(['comments' => $this->privateComments($user, 'assessment_id', $item->id)]);
    }

    public function saveAssessmentComment(Request $request, Classroom $class, string $assessment): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'student' && $class->students()->where('users.id', $user->id)->exists(), 403);
        $item = $class->assessments()->findOrFail($assessment);
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);
        DB::table('student_private_comments')->updateOrInsert(
            ['student_id' => $user->id, 'assessment_id' => $item->id],
            ['material_id' => null, 'body' => trim($data['body']), 'created_at' => now(), 'updated_at' => now()],
        );

        return response()->json(['saved' => true]);
    }

    private function privateComments(User $user, string $foreignKey, int $itemId): array
    {
        $query = DB::table('student_private_comments')
            ->join('users', 'users.id', '=', 'student_private_comments.student_id')
            ->where("student_private_comments.{$foreignKey}", $itemId)
            ->select('student_private_comments.body', 'student_private_comments.updated_at', 'users.name as studentName');
        if ($user->role === 'student') {
            $query->where('student_private_comments.student_id', $user->id);
        }

        return $query->orderBy('users.name')->get()->map(fn ($comment): array => [
            'studentName' => $comment->studentName,
            'body' => $comment->body,
            'updatedAt' => $comment->updated_at,
        ])->all();
    }

    public function materials(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $this->ensureClassAccess($user, $class);
        $items = $class->materials()->with('classroom')->orderByDesc('created_at')->get()
            ->map(fn (Material $material) => $this->materialPayload($material, $user));

        return response()->json(['data' => $items]);
    }

    public function viewSheetMusic(Request $request, Classroom $class, string $material): \Symfony\Component\HttpFoundation\StreamedResponse {
    $user = $request->attributes->get('app_user');

    // Verify that the user can access this class.
    $this->ensureClassAccess($user, $class);

    // Only retrieve materials belonging to this class.
    $item = $class->materials()->findOrFail($material);

    // Only Sheet Music materials can use this endpoint.
    abort_unless($item->kind === 'Sheet Music', 404);

    // Do not serve files while conversion is incomplete.
    abort_unless(
        $item->notation_status === 'completed'
            && is_string($item->musicxml_path)
            && $item->musicxml_path !== '',
        409,
        'The sheet music notation is not ready yet.'
    );

    $disk = Storage::disk('public');

    abort_unless(
        $disk->exists($item->musicxml_path),
        404,
        'The generated MusicXML file could not be found.'
    );

    $stream = $disk->readStream($item->musicxml_path);

    abort_unless(
        is_resource($stream),
        500,
        'Could not read the generated MusicXML file.'
    );

    return response()->stream(
        function () use ($stream): void {
            try {
                fpassthru($stream);
            } finally {
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }
        },
        200,
        [
            'Content-Type' => 'application/vnd.recordare.musicxml',
            'Content-Disposition' => 'inline; filename="sheet-music-' . $item->id . '.mxl"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]
    );
}

    public function createMaterial(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');

        abort_unless(
            $user->role === 'admin' ||
            ($user->role === 'teacher' && (int) $class->teacher_id === (int) $user->id),
            403
        );

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'kind' => ['required', 'string', 'max:32'],
            'mediaUrl' => ['nullable', 'string', 'max:1600000'],
            'streamUrl' => ['nullable', 'string', 'max:1600000'],
            'deadline' => ['nullable', 'date', 'after:now'],
            'requiresSubmission' => ['nullable', 'boolean'],
            'maxGrade' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        if (($data['requiresSubmission'] ?? false) && !isset($data['maxGrade'])) {
            return response()->json([
                'message' => 'Set a maximum grade for materials that require student submissions.'
            ], 422);
        }

        $mediaUrl = $data['mediaUrl'] ?? null;
        $streamUrl = $data['streamUrl'] ?? null;

        // Sheet Music must be uploaded as a PDF or supported image.
        if ($data['kind'] === 'Sheet Music') {
            $sheetMusicData = collect([$mediaUrl, $streamUrl])
                ->first(fn ($value) => is_string($value) && str_starts_with($value, 'data:'));

            if (
                !is_string($sheetMusicData) ||
                !preg_match(
                    '/^data:(application\/pdf|image\/(?:png|jpeg));base64,/i',
                    $sheetMusicData
                )
            ) {
                return response()->json([
                    'message' => 'Sheet Music requires a PDF, PNG, JPG, or JPEG file upload.'
                ], 422);
            }

            $mediaUrl = $sheetMusicData;
            $streamUrl = $sheetMusicData;
        }

        foreach ([$mediaUrl, $streamUrl] as $url) {
            if (
                is_string($url) &&
                $url !== '' &&
                !str_starts_with($url, 'data:') &&
                !$this->isSafeExternalUrl($url)
            ) {
                return response()->json([
                    'message' => 'Media links must use a valid HTTPS URL.'
                ], 422);
            }
        }

        $storagePath = null;

        foreach (['mediaUrl' => &$mediaUrl, 'streamUrl' => &$streamUrl] as &$candidate) {
            if (is_string($candidate) && str_starts_with($candidate, 'data:')) {
                if ($storagePath !== null) {
                    $candidate = Storage::disk(
                        config('filesystems.material_uploads_disk', 'public')
                    )->url($storagePath);

                    continue;
                }

                $storagePath = $this->storeDataUrl($candidate);

                $candidate = Storage::disk(
                    config('filesystems.material_uploads_disk', 'public')
                )->url($storagePath);
            }
        }

        unset($candidate);

        $module = $this->moduleForClass($class);

        $material = $class->materials()->create([
            'module_id' => $module->id,
            'teacher_id' => $user->id,
            'title' => trim($data['title']),
            'description' => trim($data['description']),
            'kind' => $data['kind'],
            'media_url' => $mediaUrl,
            'stream_url' => $streamUrl,
            'deadline' => $data['deadline'] ?? null,
            'requires_submission' => $data['requiresSubmission'] ?? false,
            'max_grade' => $data['maxGrade'] ?? 100,
            'storage_path' => $storagePath,
        ]);

        // Queue sheet music conversion after the material has been saved.
        if ($material->kind === 'Sheet Music' && $material->storage_path) {
            $material->update([
                'notation_status' => 'queued',
                'notation_error' => null,
                'musicxml_path' => null,
                'notation_processed_at' => null,
            ]);

            try {
                ProcessSheetMusic::dispatch($material->id);
            } catch (\Throwable $exception) {
                Log::error('Could not queue sheet music conversion.', [
                    'material_id' => $material->id,
                    'exception' => $exception::class,
                    'reason' => $exception->getMessage(),
                ]);

                $material->update([
                    'notation_status' => 'failed',
                    'notation_error' => mb_substr($exception->getMessage(), 0, 5000),
                    'notation_processed_at' => now(),
                ]);
            }
        }

        $material->refresh();

        return response()->json([
            'material' => $this->materialPayload($material, $user)
        ], 201);
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
        
        // Delete the generated MusicXML file when removing Sheet Music.
        $notationFileDeleted = false;

        if (
            is_string($item->musicxml_path) &&
            $item->musicxml_path !== ''
        ) {
            $notationPathInUse = Material::withTrashed()
                ->where('musicxml_path', $item->musicxml_path)
                ->where('id', '<>', $item->id)
                ->exists();

            if (!$notationPathInUse) {
                try {
                    $notationDisk = Storage::disk('public');

                    if ($notationDisk->exists($item->musicxml_path)) {
                        $notationFileDeleted = $notationDisk->delete(
                            $item->musicxml_path
                        );

                        if (!$notationFileDeleted) {
                            throw new \RuntimeException(
                                'The generated MusicXML file could not be deleted.'
                            );
                        }
                    }
                } catch (\Throwable $exception) {
                    Log::error('Could not delete generated MusicXML file.', [
                        'material_id' => $item->id,
                        'path' => $item->musicxml_path,
                        'reason' => $exception->getMessage(),
                    ]);

                    return response()->json([
                        'message' => 'The generated notation file could not be removed. The material was not deleted.'
                    ], 500);
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

        return response()->json([
            'deleted' => true,
            'fileDeleted' => $fileDeleted,
            'notationFileDeleted' => $notationFileDeleted,
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
        abort_if(
            $material->requires_submission
                && ! DB::table('material_submissions')->where('material_id', $material->id)->where('student_id', $user->id)->exists(),
            422,
            'Submit a file for this requirement before marking the material complete.',
        );
        DB::table('material_completions')->updateOrInsert(
            ['student_id' => $user->id, 'material_id' => $material->id],
            ['completed_at' => now()],
        );

        return response()->json(['completed' => true]);
    }

    public function materialSubmissions(Request $request, Classroom $class, Material $material): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless((int) $material->class_id === (int) $class->id, 404);
        $this->ensureClassAccess($user, $class);
        $query = DB::table('material_submissions')
            ->join('users', 'users.id', '=', 'material_submissions.student_id')
            ->where('material_submissions.material_id', $material->id)
            ->select('material_submissions.*', 'users.name as student_name');
        if ($user->role === 'student') {
            $query->where('material_submissions.student_id', $user->id);
        }

        $submissions = $query->orderBy('users.name')->get()->map(fn ($submission): array => $this->submissionPayload($submission))->values();
        return response()->json(['data' => $submissions]);
    }

    public function submitMaterialWork(Request $request, Classroom $class, Material $material): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless(
            $user->role === 'student'
                && (int) $material->class_id === (int) $class->id
                && ! $material->trashed()
                && $material->requires_submission
                && $class->students()->where('users.id', $user->id)->exists(),
            403,
        );
        $data = $request->validate(['file' => ['required', 'file', 'max:51200']]);
        $file = $data['file'];
        $path = $file->store("material-submissions/{$class->id}/{$material->id}", 'local');
        abort_unless(is_string($path) && $path !== '', 500, 'The submitted file could not be saved.');

        $key = ['material_id' => $material->id, 'student_id' => $user->id];
        $existing = DB::table('material_submissions')->where($key)->first();
        $attributes = [
            'file_path' => $path,
            'file_name' => mb_substr($file->getClientOriginalName(), 0, 255),
            'file_mime' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'submitted_at' => now(),
            'grade' => null,
            'feedback' => null,
            'graded_by' => null,
            'graded_at' => null,
            'updated_at' => now(),
        ];
        if ($existing) {
            DB::table('material_submissions')->where('id', $existing->id)->update($attributes);
            if (is_string($existing->file_path) && $existing->file_path !== $path) {
                Storage::disk('local')->delete($existing->file_path);
            }
            $submissionId = $existing->id;
        } else {
            $submissionId = DB::table('material_submissions')->insertGetId($key + $attributes + ['created_at' => now()]);
        }

        return response()->json(['submission' => [
            'id' => (string) $submissionId,
            'fileName' => $attributes['file_name'],
            'submittedAt' => now()->toISOString(),
            'grade' => null,
            'feedback' => null,
        ]], 201);
    }

    public function downloadMaterialSubmission(Request $request, Classroom $class, Material $material, int $submission): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless((int) $material->class_id === (int) $class->id, 404);
        $this->ensureClassAccess($user, $class);
        $item = DB::table('material_submissions')->where('id', $submission)->where('material_id', $material->id)->first();
        abort_unless($item, 404);
        abort_unless($user->role !== 'student' || (int) $item->student_id === (int) $user->id, 403);
        abort_unless(Storage::disk('local')->exists($item->file_path), 404, 'The submitted file is no longer available.');

        return Storage::disk('local')->download($item->file_path, $item->file_name, [
            'Content-Type' => $item->file_mime ?: 'application/octet-stream',
        ]);
    }

    public function gradeMaterialSubmission(Request $request, Classroom $class, Material $material, int $submission): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless(
            (int) $material->class_id === (int) $class->id
                && ($user->role === 'admin' || ($user->role === 'teacher' && (int) $class->teacher_id === (int) $user->id)),
            403,
        );
        $data = $request->validate([
            'grade' => ['required', 'integer', 'min:0', 'max:1000'],
            'feedback' => ['nullable', 'string', 'max:5000'],
        ]);
        abort_if((int) $data['grade'] > (int) $material->max_grade, 422, "Grade cannot exceed the assignment's maximum of {$material->max_grade}.");
        $exists = DB::table('material_submissions')->where('id', $submission)->where('material_id', $material->id)->exists();
        abort_unless($exists, 404);
        DB::table('material_submissions')->where('id', $submission)->update([
            'grade' => $data['grade'],
            'feedback' => isset($data['feedback']) ? trim($data['feedback']) : null,
            'graded_by' => $user->id,
            'graded_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['graded' => true]);
    }

    private function submissionPayload(object $submission): array
    {
        return [
            'id' => (string) $submission->id,
            'studentId' => (string) $submission->student_id,
            'studentName' => $submission->student_name,
            'fileName' => $submission->file_name,
            'fileSize' => (int) $submission->file_size,
            'submittedAt' => $submission->submitted_at,
            'grade' => $submission->grade === null ? null : (int) $submission->grade,
            'feedback' => $submission->feedback,
            'gradedAt' => $submission->graded_at,
        ];
    }

    private function materialPayload(Material $material, ?User $user = null): array
    {
        return [
            'id' => (string) $material->id,
            'title' => $material->title,
            'description' => $material->description,
            'kind' => $material->kind,
            'mediaUrl' => $this->materialUrl($material->media_url, $material->storage_path),
            'streamUrl' => $this->materialUrl($material->stream_url, $material->storage_path),
            'deadline' => $material->deadline?->toISOString(),
            'requiresSubmission' => (bool) $material->requires_submission,
            'maxGrade' => (int) ($material->max_grade ?: 100),
            'teacherName' => $material->teacher?->name,
            'canDelete' => $user?->role === 'teacher'
                && (int) $material->teacher_id === (int) $user->id,
            'notationStatus' => $material->kind === 'Sheet Music'
            ? ($material->notation_status ?? 'not_started')
            : null,
            'notationError' => $user?->role !== 'student'
                ? $material->notation_error
                : null,
            'notationProcessedAt' => $material->notation_processed_at?->toISOString(),
            'createdAt' => $material->created_at?->toISOString(),
        ];
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
        if ($contents === false || strlen($contents) > 800 * 1024) {
            abort(422, 'Uploaded media must be valid and no larger than 800 KB.');
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

    private function materialUrl(?string $url, ?string $storagePath): ?string
    {
        if (is_string($url) && is_string($storagePath)) {
            $urlPath = parse_url($url, PHP_URL_PATH);
            if (
                is_string($urlPath)
                && str_ends_with(trim(rawurldecode($urlPath), '/'), ltrim($storagePath, '/'))
            ) {
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
        }

        return $this->safeStoredUrl($url);
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

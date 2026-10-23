<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Assessment;
use App\Models\AssessmentQuestion;
use App\Models\Classroom;
use App\Models\Material;
use App\Models\Module;
use App\Models\ModuleProgress;
use App\Models\QuizAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class LearningController extends Controller
{
    public function materials(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $this->ensureClassAccess($user, $class);
        $items = $class->materials()->with('classroom')->orderByDesc('created_at')->get()
            ->map(fn (Material $material) => $this->materialPayload($material));

        return response()->json(['data' => $items]);
    }

    public function createMaterial(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'admin' || ($user->role === 'teacher' && $class->teacher_id === $user->id), 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'kind' => ['required', 'string', 'max:32'],
            'mediaUrl' => ['nullable', 'string', 'max:1600000'],
            'streamUrl' => ['nullable', 'string', 'max:1600000'],
        ]);

        $mediaUrl = $data['mediaUrl'] ?? null;
        $streamUrl = $data['streamUrl'] ?? null;
        foreach ([$mediaUrl, $streamUrl] as $url) {
            if (is_string($url) && $url !== '' && ! str_starts_with($url, 'data:') && ! $this->isSafeExternalUrl($url)) {
                return response()->json(['message' => 'Media links must use a valid HTTPS URL.'], 422);
            }
        }
        $storagePath = null;
        foreach (['mediaUrl' => &$mediaUrl, 'streamUrl' => &$streamUrl] as &$candidate) {
            if (is_string($candidate) && str_starts_with($candidate, 'data:')) {
                if ($storagePath !== null) {
                    $candidate = Storage::disk('public')->url($storagePath);

                    continue;
                }
                $storagePath = $this->storeDataUrl($candidate);
                $candidate = Storage::disk('public')->url($storagePath);
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
            'storage_path' => $storagePath,
        ]);

        return response()->json(['material' => $this->materialPayload($material)], 201);
    }

    public function assessment(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $this->ensureClassAccess($user, $class);
        $assessment = $class->assessment()->with('questions')->first();

        return response()->json([
            'assessment' => $assessment ? $this->assessmentPayload($assessment, $user->role !== 'student') : null,
        ]);
    }

    public function publishAssessment(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'admin' || ($user->role === 'teacher' && $class->teacher_id === $user->id), 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'passingPercent' => ['required', 'integer', 'between:0,100'],
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

        $assessment = DB::transaction(function () use ($class, $data, $user): Assessment {
            $module = $this->moduleForClass($class, $user->id);
            $assessment = Assessment::query()->updateOrCreate(
                ['class_id' => $class->id],
                ['module_id' => $module->id, 'title' => $data['title'], 'passing_percent' => $data['passingPercent']],
            );
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

        return response()->json(['assessment' => $this->assessmentPayload($assessment, true)]);
    }

    public function submitAssessment(Request $request, Classroom $class): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role === 'student', 403);
        abort_unless($class->students()->where('users.id', $user->id)->exists(), 403, 'Enroll in this class before submitting an assessment.');
        $data = $request->validate(['answers' => ['required', 'array', 'min:1']]);
        $assessment = $class->assessment()->with('questions')->firstOrFail();
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
            ->pluck('material_completions.material_id')
            ->map(fn ($id) => (string) $id)
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
                && $class->students()->where('users.id', $user->id)->exists(),
            403,
        );
        DB::table('material_completions')->updateOrInsert(
            ['student_id' => $user->id, 'material_id' => $material->id],
            ['completed_at' => now()],
        );

        return response()->json(['completed' => true]);
    }

    private function materialPayload(Material $material): array
    {
        return [
            'id' => (string) $material->id,
            'title' => $material->title,
            'description' => $material->description,
            'kind' => $material->kind,
            'mediaUrl' => $this->safeStoredUrl($material->media_url),
            'streamUrl' => $this->safeStoredUrl($material->stream_url),
            'teacherName' => $material->teacher?->name,
            'createdAt' => $material->created_at?->toISOString(),
        ];
    }

    private function assessmentPayload(Assessment $assessment, bool $includeAnswers): array
    {
        return [
            'id' => (string) $assessment->id,
            'title' => $assessment->title,
            'passingPercent' => $assessment->passing_percent,
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
        if (! Storage::disk('public')->put($path, $contents)) {
            abort(500, 'The uploaded media could not be saved.');
        }

        return $path;
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

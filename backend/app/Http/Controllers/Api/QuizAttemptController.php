<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssessmentAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuizAttemptController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $student = $request->attributes->get('app_user');
        abort_unless($student->role === 'student', 403);

        $attempts = AssessmentAttempt::query()
            ->with(['assessment.classroom'])
            ->where('student_id', $student->id)
            ->orderByDesc('submitted_at')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => $attempts->map(fn (AssessmentAttempt $attempt): array => [
                'id' => (string) $attempt->id,
                'quizTitle' => $attempt->assessment?->title ?? 'Assessment',
                'className' => $attempt->assessment?->classroom?->name,
                'score' => $attempt->score,
                'passed' => $attempt->passed,
                'submittedAt' => $attempt->submitted_at?->toISOString(),
            ]),
        ]);
    }
}

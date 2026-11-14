<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChatbotController extends Controller
{
    private const SEARCH_STOP_WORDS = [
        'a', 'an', 'the', 'how', 'do', 'does', 'did', 'i', 'me', 'my', 'you', 'your',
        'what', 'whats', 'when', 'where', 'why', 'can', 'could', 'would', 'should',
        'is', 'are', 'am', 'to', 'for', 'of', 'on', 'in', 'with', 'please', 'tell',
    ];

    public function index(): JsonResponse
    {
        return response()->json(['data' => DB::table('chatbot_responses')->orderBy('id')->get()->map(
            fn ($item) => [
                'id' => $item->legacy_key ?: (string) $item->id,
                'keywords' => $item->keywords,
                'response' => $item->response,
                'deleted' => (bool) $item->deleted,
            ],
        )]);
    }

    public function search(Request $request): JsonResponse
    {
        $query = $request->validate([
            'q' => ['required', 'string', 'max:200'],
        ])['q'];
        $queryWords = $this->searchWords($query);

        if ($queryWords === []) {
            return response()->json(['data' => []]);
        }

        $matches = [];
        foreach (DB::table('chatbot_responses')
            ->where('deleted', false)
            ->orderBy('id')
            ->get() as $item) {
            if (! trim($item->keywords)) {
                continue;
            }

            $score = $this->searchScore($queryWords, $item->keywords);
            if ($score === 0) {
                continue;
            }

            $matches[] = [
                'sort_id' => (int) $item->id,
                'score' => $score,
                'data' => [
                    'id' => $item->legacy_key ?: (string) $item->id,
                    'keywords' => $item->keywords,
                    'response' => $item->response,
                    'deleted' => (bool) $item->deleted,
                ],
            ];
        }

        usort($matches, static fn (array $left, array $right): int =>
            ($right['score'] <=> $left['score']) ?: ($left['sort_id'] <=> $right['sort_id'])
        );

        return response()->json([
            'data' => array_column($matches, 'data'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $id = DB::table('chatbot_responses')->insertGetId([
            'keywords' => $data['keywords'],
            'response' => $data['response'],
            'deleted' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['response' => $this->find($id)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'keywords' => ['sometimes', 'required', 'string'],
            'response' => ['sometimes', 'required', 'string'],
            'deleted' => ['sometimes', 'boolean'],
        ]);
        $record = DB::table('chatbot_responses')
            ->where('legacy_key', $id)
            ->orWhere('id', ctype_digit($id) ? (int) $id : 0)
            ->first();
        abort_unless($record, 404);
        DB::table('chatbot_responses')->where('id', $record->id)->update([...$data, 'updated_at' => now()]);

        return response()->json(['response' => $this->find($record->id)]);
    }

    public function destroy(string $id): JsonResponse
    {
        $record = DB::table('chatbot_responses')
            ->where('legacy_key', $id)
            ->orWhere('id', ctype_digit($id) ? (int) $id : 0)
            ->first();
        abort_unless($record, 404);
        if ($record->legacy_key !== null) {
            DB::table('chatbot_responses')->where('id', $record->id)->update(['deleted' => true, 'updated_at' => now()]);
        } else {
            DB::table('chatbot_responses')->where('id', $record->id)->delete();
        }

        return response()->json(['deleted' => true]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'keywords' => ['required', 'string'],
            'response' => ['required', 'string'],
        ]);
    }

    private function find(int $id): array
    {
        $item = DB::table('chatbot_responses')->where('id', $id)->first();

        return [
            'id' => $item->legacy_key ?: (string) $item->id,
            'keywords' => $item->keywords,
            'response' => $item->response,
            'deleted' => (bool) $item->deleted,
        ];
    }

    private function searchScore(array $queryWords, string $keywords): int
    {
        $score = 0;
        foreach ($this->searchWords($keywords) as $keyword) {
            $bestWordScore = 0;
            foreach ($queryWords as $word) {
                if ($word === $keyword) {
                    $bestWordScore = max($bestWordScore, 3);
                    continue;
                }

                $minimumLength = min(strlen($word), strlen($keyword));
                if (
                    $minimumLength >= 3
                    && (str_contains($word, $keyword) || str_contains($keyword, $word))
                ) {
                    $bestWordScore = max($bestWordScore, 2);
                    continue;
                }

                if ($minimumLength >= 4 && $this->keywordDistanceIsOne($word, $keyword)) {
                    $bestWordScore = max($bestWordScore, 1);
                }
            }
            $score += $bestWordScore;
        }

        return $score;
    }

    private function searchWords(string $text): array
    {
        preg_match_all("/[a-z0-9']+/", strtolower($text), $matches);

        return array_values(array_filter(
            $matches[0],
            static fn (string $word): bool => ! in_array($word, self::SEARCH_STOP_WORDS, true),
        ));
    }

    private function keywordDistanceIsOne(string $left, string $right): bool
    {
        if (abs(strlen($left) - strlen($right)) > 1) {
            return false;
        }

        $leftIndex = 0;
        $rightIndex = 0;
        $differences = 0;

        while ($leftIndex < strlen($left) && $rightIndex < strlen($right)) {
            if ($left[$leftIndex] === $right[$rightIndex]) {
                $leftIndex++;
                $rightIndex++;
                continue;
            }

            $differences++;
            if ($differences > 1) {
                return false;
            }
            if (strlen($left) > strlen($right)) {
                $leftIndex++;
            } elseif (strlen($right) > strlen($left)) {
                $rightIndex++;
            } else {
                $leftIndex++;
                $rightIndex++;
            }
        }

        if ($leftIndex < strlen($left) || $rightIndex < strlen($right)) {
            $differences++;
        }

        return $differences === 1;
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChatbotController extends Controller
{
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
}

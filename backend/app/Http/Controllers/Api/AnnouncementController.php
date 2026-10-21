<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnnouncementController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => DB::table('announcements')->orderByDesc('created_at')->get()->map(
            fn ($item) => [
                'id' => (string) $item->id,
                'title' => $item->title,
                'content' => $item->content,
                'createdAt' => $item->created_at,
            ],
        )]);
    }

    public function store(Request $request): JsonResponse
    {
        $item = $this->validated($request);
        $id = DB::table('announcements')->insertGetId([
            'author_id' => $request->attributes->get('app_user')->id,
            ...$item,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['announcement' => $this->find($id)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $item = $this->validated($request);
        abort_unless(DB::table('announcements')->where('id', $id)->exists(), 404);
        DB::table('announcements')->where('id', $id)->update([...$item, 'updated_at' => now()]);

        return response()->json(['announcement' => $this->find($id)]);
    }

    public function destroy(string $id): JsonResponse
    {
        abort_unless(DB::table('announcements')->where('id', $id)->delete(), 404);

        return response()->json(['deleted' => true]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
        ]);
    }

    private function find(string $id): array
    {
        $item = DB::table('announcements')->where('id', $id)->first();

        return [
            'id' => (string) $item->id,
            'title' => $item->title,
            'content' => $item->content,
            'createdAt' => $item->created_at,
        ];
    }
}

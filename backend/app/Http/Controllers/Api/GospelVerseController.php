<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GospelVerse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GospelVerseController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => GospelVerse::query()
                ->orderBy('id')
                ->get(['id', 'book', 'chapter', 'verse']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'book' => ['required', 'string', 'max:40', 'regex:/^[a-z]+(?:-[a-z]+)*$/'],
            'chapter' => ['required', 'integer', 'min:1', 'max:150'],
            'verse' => ['required', 'integer', 'min:1', 'max:176'],
        ]);

        $verse = GospelVerse::query()->firstOrCreate($data);
        if (! $verse->wasRecentlyCreated) {
            return response()->json(['message' => 'This verse is already in the rotation.'], 422);
        }

        return response()->json(['verse' => $verse], 201);
    }

    public function destroy(GospelVerse $gospelVerse): JsonResponse
    {
        if (GospelVerse::query()->count() <= 1) {
            return response()->json(['message' => 'The rotation must contain at least one verse.'], 422);
        }

        $gospelVerse->delete();

        return response()->json(['message' => 'Verse removed from rotation.']);
    }
}

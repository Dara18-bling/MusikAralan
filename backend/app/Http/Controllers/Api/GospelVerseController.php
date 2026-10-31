<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GospelVerse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GospelVerseController extends Controller
{
    private const SUPPORTED_BOOK_IDS = [
        'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT',
        '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH',
        'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER',
        'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON',
        'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT',
        'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL',
        'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT',
        'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN',
        'JUD', 'REV',
    ];

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
            'book' => ['required', 'string', Rule::in(self::SUPPORTED_BOOK_IDS)],
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

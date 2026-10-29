<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SettingController extends Controller
{
    public function appearance(): JsonResponse
    {
        $setting = DB::table('settings')->where('key', 'appearance')->first();
        $appearance = $setting ? json_decode($setting->value, true) : null;

        return response()->json([
            'appearance' => $appearance,
            'palettes' => is_array($appearance['palettes'] ?? null) ? $appearance['palettes'] : [],
        ]);
    }

    public function saveAppearance(Request $request): JsonResponse
    {
        $setting = DB::table('settings')->where('key', 'appearance')->first();
        $appearance = $setting ? json_decode($setting->value, true) : [];
        $palettes = is_array($appearance['palettes'] ?? null) ? $appearance['palettes'] : [];
        $paletteNames = collect($palettes)
            ->pluck('name')
            ->filter(fn ($name): bool => is_string($name))
            ->values()
            ->all();

        $data = $request->validate([
            'primaryColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'secondaryColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'paletteName' => ['required', 'string', 'max:120', Rule::in($paletteNames)],
        ]);
        $selectedPalette = collect($palettes)->first(
            fn ($palette): bool => is_array($palette) && ($palette['name'] ?? null) === $data['paletteName'],
        );

        if (
            ! is_array($selectedPalette)
            || strtolower((string) ($selectedPalette['primary'] ?? '')) !== strtolower($data['primaryColor'])
            || strtolower((string) ($selectedPalette['secondary'] ?? '')) !== strtolower($data['secondaryColor'])
        ) {
            throw ValidationException::withMessages([
                'paletteName' => 'Choose a color palette configured by the system.',
            ]);
        }

        $updatedAppearance = [...$data, 'palettes' => $palettes];
        DB::table('settings')->updateOrInsert(
            ['key' => 'appearance'],
            ['value' => json_encode($updatedAppearance, JSON_THROW_ON_ERROR), 'updated_at' => now(), 'created_at' => now()],
        );

        return response()->json([
            'appearance' => $updatedAppearance,
            'palettes' => $palettes,
        ]);
    }
}

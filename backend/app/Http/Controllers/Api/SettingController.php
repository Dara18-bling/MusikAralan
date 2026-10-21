<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SettingController extends Controller
{
    public function appearance(): JsonResponse
    {
        $setting = DB::table('settings')->where('key', 'appearance')->first();

        return response()->json(['appearance' => $setting ? json_decode($setting->value, true) : null]);
    }

    public function saveAppearance(Request $request): JsonResponse
    {
        $data = $request->validate([
            'primaryColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'secondaryColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'paletteName' => ['required', 'string', 'max:120'],
        ]);
        DB::table('settings')->updateOrInsert(
            ['key' => 'appearance'],
            ['value' => json_encode($data, JSON_THROW_ON_ERROR), 'updated_at' => now(), 'created_at' => now()],
        );

        return response()->json(['appearance' => $data]);
    }
}

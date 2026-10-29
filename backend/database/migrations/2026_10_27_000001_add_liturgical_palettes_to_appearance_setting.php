<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $palettes = [
        ['name' => 'Advent & Lent · Violet', 'primary' => '#6842a6', 'secondary' => '#a855a0'],
        ['name' => 'Easter & Christmas · White and gold', 'primary' => '#c28b22', 'secondary' => '#f2d477'],
        ['name' => 'Ordinary Time · Green', 'primary' => '#287653', 'secondary' => '#79a94b'],
        ['name' => 'Feasts · Red', 'primary' => '#a8323b', 'secondary' => '#e16c48'],
        ['name' => 'Marian · Pink and blue', 'primary' => '#e88faf', 'secondary' => '#7ea9d2'],
    ];

    public function up(): void
    {
        $setting = DB::table('settings')->where('key', 'appearance')->first();
        $appearance = $setting ? json_decode($setting->value, true) : [];
        $appearance = is_array($appearance) ? $appearance : [];
        $defaultPalette = $this->palettes[0];
        $appearance['primaryColor'] ??= $defaultPalette['primary'];
        $appearance['secondaryColor'] ??= $defaultPalette['secondary'];
        $appearance['paletteName'] ??= $defaultPalette['name'];
        $appearance['palettes'] = $this->palettes;

        DB::table('settings')->updateOrInsert(
            ['key' => 'appearance'],
            [
                'value' => json_encode($appearance, JSON_THROW_ON_ERROR),
                'created_at' => $setting?->created_at ?? now(),
                'updated_at' => now(),
            ],
        );
    }

    public function down(): void
    {
        $setting = DB::table('settings')->where('key', 'appearance')->first();
        if (! $setting) {
            return;
        }

        $appearance = json_decode($setting->value, true);
        if (! is_array($appearance)) {
            return;
        }

        unset($appearance['palettes']);
        DB::table('settings')
            ->where('key', 'appearance')
            ->update([
                'value' => json_encode($appearance, JSON_THROW_ON_ERROR),
                'updated_at' => now(),
            ]);
    }
};

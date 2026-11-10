<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $setting = DB::table('settings')->where('key', 'appearance')->first();
        if (! $setting) {
            return;
        }

        $appearance = json_decode($setting->value, true);
        if (! is_array($appearance) || ! array_key_exists('palettes', $appearance)) {
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

    public function down(): void
    {
        // Palette options are deployment configuration and cannot be restored from the database.
    }
};

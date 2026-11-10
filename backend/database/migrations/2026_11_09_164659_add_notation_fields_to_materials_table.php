<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->string('notation_status', 30)
                ->default('not_started');

            $table->string('musicxml_path')
                ->nullable();

            $table->text('notation_error')
                ->nullable();

            $table->timestamp('notation_processed_at')
                ->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn([
                'notation_status',
                'musicxml_path',
                'notation_error',
                'notation_processed_at',
            ]);
        });
    }
};
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {

            if (!Schema::hasColumn('materials', 'deadline')) {
                $table->dateTime('deadline')->nullable();
            }

            if (!Schema::hasColumn('materials', 'requires_submission')) {
                $table->boolean('requires_submission')->default(false);
            }

        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {

            if (Schema::hasColumn('materials', 'deadline')) {
                $table->dropColumn('deadline');
            }

            if (Schema::hasColumn('materials', 'requires_submission')) {
                $table->dropColumn('requires_submission');
            }

        });
    }
};
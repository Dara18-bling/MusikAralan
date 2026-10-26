<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assessments', function (Blueprint $table) {
            $table->dropUnique('assessments_class_id_unique');
            $table->string('assessment_code', 32)->default('A1')->after('class_id');
            $table->unique(['class_id', 'assessment_code']);
        });
    }

    public function down(): void
    {
        Schema::table('assessments', function (Blueprint $table) {
            $table->dropUnique(['class_id', 'assessment_code']);
            $table->dropColumn('assessment_code');
            $table->unique('class_id');
        });
    }
};

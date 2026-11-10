<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voice_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('user_voice_group', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('voice_group_id')->constrained()->cascadeOnDelete();
            $table->string('voice_part', 80)->nullable();
            $table->timestamps();
            $table->primary(['user_id', 'voice_group_id']);
        });

        Schema::create('modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
            $table->string('title');
            $table->string('category', 120)->nullable();
            $table->text('description')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('requires_practice')->default(false);
            $table->timestamps();
            $table->index(['class_id', 'created_at']);
        });

        Schema::table('materials', function (Blueprint $table) {
            $table->foreignId('module_id')->nullable()->after('class_id')->constrained('modules')->nullOnDelete();
            $table->foreignId('voice_group_id')->nullable()->after('module_id')->constrained('voice_groups')->nullOnDelete();
        });

        Schema::table('assessments', function (Blueprint $table) {
            $table->foreignId('module_id')->nullable()->after('class_id')->constrained('modules')->nullOnDelete();
        });

        DB::table('classes')->orderBy('id')->each(function (object $class): void {
            $moduleId = DB::table('modules')->insertGetId([
                'class_id' => $class->id,
                'title' => $class->name,
                'category' => $class->age_group,
                'description' => $class->description,
                'created_by' => $class->teacher_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('materials')->where('class_id', $class->id)->update(['module_id' => $moduleId]);
            DB::table('assessments')->where('class_id', $class->id)->update(['module_id' => $moduleId]);
        });

        Schema::table('announcements', function (Blueprint $table) {
            $table->foreignId('target_group_id')->nullable()->after('author_id')->constrained('voice_groups')->nullOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('approved_by')->nullable()->after('status')->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable()->after('approved_by');
        });

        Schema::create('module_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('module_id')->constrained('modules')->cascadeOnDelete();
            $table->string('status', 24)->default('not_started');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'module_id']);
        });

        DB::table('assessment_attempts')
            ->join('assessments', 'assessments.id', '=', 'assessment_attempts.assessment_id')
            ->whereNotNull('assessments.module_id')
            ->select('assessment_attempts.student_id', 'assessments.module_id')
            ->distinct()
            ->orderBy('assessment_attempts.student_id')
            ->each(function (object $attempt): void {
                $hasPassed = DB::table('assessment_attempts')
                    ->join('assessments', 'assessments.id', '=', 'assessment_attempts.assessment_id')
                    ->where('assessment_attempts.student_id', $attempt->student_id)
                    ->where('assessments.module_id', $attempt->module_id)
                    ->where('assessment_attempts.passed', true)
                    ->exists();

                DB::table('module_progress')->insert([
                    'user_id' => $attempt->student_id,
                    'module_id' => $attempt->module_id,
                    'status' => $hasPassed ? 'completed' : 'in_progress',
                    'completed_at' => $hasPassed ? now() : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

        Schema::table('assessment_attempts', function (Blueprint $table) {
            $table->foreignId('module_progress_id')->nullable()->after('student_id')->constrained('module_progress')->nullOnDelete();
            $table->string('status', 24)->default('failed')->after('score');
            $table->index(['module_progress_id', 'status']);
        });

        DB::table('assessment_attempts')
            ->join('assessments', 'assessments.id', '=', 'assessment_attempts.assessment_id')
            ->whereNotNull('assessments.module_id')
            ->select('assessment_attempts.id', 'assessment_attempts.student_id', 'assessment_attempts.passed', 'assessments.module_id')
            ->orderBy('assessment_attempts.id')
            ->each(function (object $attempt): void {
                $progressId = DB::table('module_progress')
                    ->where('user_id', $attempt->student_id)
                    ->where('module_id', $attempt->module_id)
                    ->value('id');

                DB::table('assessment_attempts')->where('id', $attempt->id)->update([
                    'module_progress_id' => $progressId,
                    'status' => $attempt->passed ? 'passed' : 'failed',
                ]);
            });

        Schema::create('practice_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('module_progress_id')->constrained('module_progress')->cascadeOnDelete();
            $table->string('practice_type', 32);
            $table->unsignedTinyInteger('score')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['module_progress_id', 'practice_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('practice_sessions');
        Schema::table('assessment_attempts', function (Blueprint $table) {
            $table->dropForeign(['module_progress_id']);
            $table->dropIndex(['module_progress_id', 'status']);
            $table->dropColumn(['module_progress_id', 'status']);
        });
        Schema::dropIfExists('module_progress');
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['approved_by']);
            $table->dropColumn(['approved_by', 'approved_at']);
        });
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropForeign(['target_group_id']);
            $table->dropColumn('target_group_id');
        });
        Schema::table('assessments', function (Blueprint $table) {
            $table->dropForeign(['module_id']);
            $table->dropColumn('module_id');
        });
        Schema::table('materials', function (Blueprint $table) {
            $table->dropForeign(['module_id']);
            $table->dropForeign(['voice_group_id']);
            $table->dropColumn(['module_id', 'voice_group_id']);
        });
        Schema::dropIfExists('modules');
        Schema::dropIfExists('user_voice_group');
        Schema::dropIfExists('voice_groups');
    }
};

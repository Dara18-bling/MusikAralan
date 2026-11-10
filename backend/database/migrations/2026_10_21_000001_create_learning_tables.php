<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classes', function (Blueprint $table) {
            $table->id();
            $table->string('legacy_id')->nullable()->unique();
            $table->string('name');
            $table->foreignId('teacher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('age_group', 16)->default('all');
            $table->text('description')->nullable();
            $table->boolean('available_for_enrollment')->default(false);
            $table->boolean('deleted')->default(false);
            $table->timestamp('enrollment_updated_at')->nullable();
            $table->timestamps();
        });

        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('enrolled_at')->useCurrent();
            $table->unique(['class_id', 'student_id']);
        });

        Schema::create('materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained()->cascadeOnDelete();
            $table->string('legacy_id')->nullable();
            $table->foreignId('teacher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->text('description');
            $table->string('kind', 32);
            $table->text('media_url')->nullable();
            $table->text('stream_url')->nullable();
            $table->string('storage_path')->nullable();
            $table->timestamps();
            $table->unique(['class_id', 'legacy_id']);
        });

        Schema::create('assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->unsignedTinyInteger('passing_percent')->default(70);
            $table->timestamps();
        });

        Schema::create('assessment_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assessment_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->text('prompt');
            $table->string('type', 24);
            $table->json('options')->nullable();
            $table->unsignedSmallInteger('correct_option_index')->nullable();
            $table->text('correct_answer')->nullable();
            $table->unique(['assessment_id', 'position']);
        });

        Schema::create('assessment_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->string('legacy_key')->nullable()->unique();
            $table->unsignedTinyInteger('score');
            $table->boolean('passed');
            $table->timestamp('submitted_at')->useCurrent();
            $table->index(['student_id', 'assessment_id']);
        });

        Schema::create('assessment_attempt_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attempt_id')->constrained('assessment_attempts')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('assessment_questions')->cascadeOnDelete();
            $table->text('answer')->nullable();
            $table->boolean('correct');
            $table->unique(['attempt_id', 'question_id']);
        });

        Schema::create('material_completions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('material_id')->constrained()->cascadeOnDelete();
            $table->timestamp('completed_at')->useCurrent();
            $table->unique(['student_id', 'material_id']);
        });

        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->string('legacy_id')->nullable()->unique();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->text('content');
            $table->timestamps();
        });

        Schema::create('chatbot_responses', function (Blueprint $table) {
            $table->id();
            $table->string('legacy_key')->nullable()->unique();
            $table->text('keywords');
            $table->text('response');
            $table->boolean('deleted')->default(false);
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->json('value');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('chatbot_responses');
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('material_completions');
        Schema::dropIfExists('assessment_attempt_answers');
        Schema::dropIfExists('assessment_attempts');
        Schema::dropIfExists('assessment_questions');
        Schema::dropIfExists('assessments');
        Schema::dropIfExists('materials');
        Schema::dropIfExists('enrollments');
        Schema::dropIfExists('classes');
    }
};

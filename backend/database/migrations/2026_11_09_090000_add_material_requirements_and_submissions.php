<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table): void {
            $table->boolean('requires_submission')->default(false)->after('deadline');
        });

        Schema::create('material_submissions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('material_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('graded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('file_path');
            $table->string('file_name');
            $table->string('file_mime', 255)->nullable();
            $table->unsignedBigInteger('file_size');
            $table->timestamp('submitted_at')->useCurrent();
            $table->unsignedTinyInteger('grade')->nullable();
            $table->text('feedback')->nullable();
            $table->timestamp('graded_at')->nullable();
            $table->timestamps();
            $table->unique(['material_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_submissions');
        Schema::table('materials', function (Blueprint $table): void {
            $table->dropColumn('requires_submission');
        });
    }
};

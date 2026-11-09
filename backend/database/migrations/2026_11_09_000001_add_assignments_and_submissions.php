<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table): void {
            $table->boolean('is_assignment')->default(false);
            $table->timestamp('available_from')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->boolean('allow_late_submissions')->default(false);
            $table->unsignedSmallInteger('max_points')->default(100);
        });

        Schema::create('assignment_submissions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('material_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->string('storage_path')->nullable();
            $table->string('file_name')->nullable();
            $table->string('mime_type', 160)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->text('drive_url')->nullable();
            $table->timestamp('submitted_at')->useCurrent();
            $table->unsignedSmallInteger('grade')->nullable();
            $table->text('feedback')->nullable();
            $table->foreignId('graded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('graded_at')->nullable();
            $table->timestamps();
            $table->unique(['material_id', 'student_id']);
            $table->index(['material_id', 'submitted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_submissions');

        Schema::table('materials', function (Blueprint $table): void {
            $table->dropColumn([
                'is_assignment',
                'available_from',
                'due_at',
                'allow_late_submissions',
                'max_points',
            ]);
        });
    }
};

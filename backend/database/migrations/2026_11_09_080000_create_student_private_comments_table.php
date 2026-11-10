<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_private_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('material_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('assessment_id')->nullable()->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();
            $table->unique(['student_id', 'material_id']);
            $table->unique(['student_id', 'assessment_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_private_comments');
    }
};

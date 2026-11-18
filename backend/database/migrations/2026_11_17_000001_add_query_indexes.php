<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('classes', function (Blueprint $table): void {
            $table->index('deleted', 'classes_deleted_index');
            $table->index(['teacher_id', 'deleted'], 'classes_teacher_deleted_index');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->index(['status', 'role'], 'users_status_role_index');
            $table->index(['role', 'status', 'name'], 'users_role_status_name_index');
        });

        Schema::table('enrollments', function (Blueprint $table): void {
            $table->index(['student_id', 'class_id'], 'enrollments_student_class_index');
        });

        Schema::table('user_voice_group', function (Blueprint $table): void {
            $table->index(['voice_group_id', 'user_id'], 'user_voice_group_group_user_index');
        });

        Schema::table('materials', function (Blueprint $table): void {
            $table->index(['class_id', 'created_at'], 'materials_class_created_index');
            $table->index('storage_path', 'materials_storage_path_index');
        });

        Schema::table('assessments', function (Blueprint $table): void {
            $table->index(['class_id', 'id'], 'assessments_class_id_index');
            $table->index('module_id', 'assessments_module_index');
        });

        Schema::table('assessment_attempts', function (Blueprint $table): void {
            $table->index(['student_id', 'submitted_at'], 'assessment_attempts_student_submitted_index');
            $table->index(
                ['assessment_id', 'student_id', 'submitted_at'],
                'assessment_attempts_assessment_student_submitted_index',
            );
        });

        Schema::table('module_progress', function (Blueprint $table): void {
            $table->index('status', 'module_progress_status_index');
        });

        Schema::table('practice_sessions', function (Blueprint $table): void {
            $table->index(
                ['module_progress_id', 'completed_at'],
                'practice_sessions_progress_completed_index',
            );
        });

        Schema::table('announcements', function (Blueprint $table): void {
            $table->index('target_group_id', 'announcements_target_group_index');
        });

        Schema::table('schedule_events', function (Blueprint $table): void {
            $table->index('starts_at', 'schedule_events_starts_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('schedule_events', function (Blueprint $table): void {
            $table->dropIndex('schedule_events_starts_at_index');
        });
        Schema::table('announcements', function (Blueprint $table): void {
            $table->dropIndex('announcements_target_group_index');
        });
        Schema::table('practice_sessions', function (Blueprint $table): void {
            $table->dropIndex('practice_sessions_progress_completed_index');
        });
        Schema::table('module_progress', function (Blueprint $table): void {
            $table->dropIndex('module_progress_status_index');
        });
        Schema::table('assessment_attempts', function (Blueprint $table): void {
            $table->dropIndex('assessment_attempts_assessment_student_submitted_index');
            $table->dropIndex('assessment_attempts_student_submitted_index');
        });
        Schema::table('assessments', function (Blueprint $table): void {
            $table->dropIndex('assessments_module_index');
            $table->dropIndex('assessments_class_id_index');
        });
        Schema::table('materials', function (Blueprint $table): void {
            $table->dropIndex('materials_storage_path_index');
            $table->dropIndex('materials_class_created_index');
        });
        Schema::table('user_voice_group', function (Blueprint $table): void {
            $table->dropIndex('user_voice_group_group_user_index');
        });
        Schema::table('enrollments', function (Blueprint $table): void {
            $table->dropIndex('enrollments_student_class_index');
        });
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex('users_role_status_name_index');
            $table->dropIndex('users_status_role_index');
        });
        Schema::table('classes', function (Blueprint $table): void {
            $table->dropIndex('classes_teacher_deleted_index');
            $table->dropIndex('classes_deleted_index');
        });
    }
};

<?php

namespace Tests\Feature;

use App\Models\Classroom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class DashboardAndScheduleTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_schedule_an_event_for_students_in_a_handled_class(): void
    {
        $teacher = $this->createUser('schedule-teacher@example.test', 'teacher');
        $student = $this->createUser('schedule-student@example.test', 'student');
        $otherStudent = $this->createUser('schedule-other@example.test', 'student');
        $class = Classroom::query()->create(['name' => 'Rehearsal class', 'teacher_id' => $teacher->id]);
        $otherClass = Classroom::query()->create(['name' => 'Other class']);
        $class->students()->attach($student->id, ['enrolled_at' => now()]);

        $this->withToken($teacher->createToken('test')->plainTextToken)
            ->postJson('/api/schedules', [
                'classId' => $class->id,
                'title' => 'Choir rehearsal',
                'startsAt' => now()->addDays(2)->toISOString(),
                'joinUrl' => 'https://meet.google.com/example',
            ])
            ->assertCreated()
            ->assertJsonPath('schedule.className', 'Rehearsal class');
        $this->assertDatabaseHas('schedule_events', ['class_id' => $class->id, 'title' => 'Choir rehearsal']);
        $this->assertSame(1, $student->fresh()->notifications()->count());
        $this->assertSame(0, $otherStudent->fresh()->notifications()->count());

        Auth::forgetGuards();
        $this->withToken($teacher->createToken('second-test')->plainTextToken)
            ->postJson('/api/schedules', [
                'classId' => $otherClass->id,
                'title' => 'Unauthorized session',
                'startsAt' => now()->addDays(2)->toISOString(),
            ])
            ->assertForbidden();
    }

    public function test_dashboard_metrics_and_quiz_attempt_history_are_database_backed(): void
    {
        $this->seed();
        $student = User::query()->where('email', 'student@musik.test')->firstOrFail();
        $response = $this->withToken($student->createToken('test')->plainTextToken)
            ->getJson('/api/dashboard')
            ->assertOk();
        $this->assertGreaterThan(0, $response->json('dashboard.classes'));

        Auth::forgetGuards();
        $this->withToken($student->createToken('history-test')->plainTextToken)
            ->getJson('/api/quiz-attempts')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_gospel_verse_rotation_is_readable_by_approved_users_and_managed_by_admins(): void
    {
        $admin = $this->createUser('gospel-admin@example.test', 'admin');
        $student = $this->createUser('gospel-student@example.test', 'student');
        $adminToken = $admin->createToken('gospel-admin')->plainTextToken;
        $studentToken = $student->createToken('gospel-student')->plainTextToken;

        $this->withToken($studentToken)
            ->getJson('/api/gospel-verses')
            ->assertOk()
            ->assertJsonCount(6, 'data');

        $this->withToken($studentToken)
            ->postJson('/api/gospel-verses', [
                'book' => 'john',
                'chapter' => 3,
                'verse' => 16,
            ])
            ->assertForbidden();

        Auth::forgetGuards();
        $createdVerse = $this->withToken($adminToken)
            ->postJson('/api/gospel-verses', [
                'book' => 'john',
                'chapter' => 1,
                'verse' => 1,
            ])
            ->assertCreated()
            ->assertJsonPath('verse.book', 'john')
            ->json('verse.id');

        Auth::forgetGuards();
        $this->withToken($admin->createToken('gospel-admin-duplicate')->plainTextToken)
            ->postJson('/api/gospel-verses', [
                'book' => 'john',
                'chapter' => 1,
                'verse' => 1,
            ])
            ->assertUnprocessable();

        Auth::forgetGuards();
        $this->withToken($student->createToken('gospel-student-list')->plainTextToken)
            ->getJson('/api/gospel-verses')
            ->assertOk()
            ->assertJsonCount(7, 'data');

        Auth::forgetGuards();
        $this->withToken($admin->createToken('gospel-admin-delete')->plainTextToken)
            ->deleteJson("/api/gospel-verses/{$createdVerse}")
            ->assertOk();
    }

    public function test_class_can_have_multiple_assessments_with_isolated_questions_and_attempts(): void
    {
        $teacher = $this->createUser('multiple-assessments-teacher@example.test', 'teacher');
        $student = $this->createUser('multiple-assessments-student@example.test', 'student');
        $class = Classroom::query()->create([
            'name' => 'Music class',
            'teacher_id' => $teacher->id,
        ]);
        $class->students()->attach($student->id, ['enrolled_at' => now()]);
        $teacherToken = $teacher->createToken('assessments-teacher')->plainTextToken;

        $firstAssessment = $this->withToken($teacherToken)
            ->postJson("/api/classes/{$class->id}/assessments", [
                'title' => 'Music Theory',
                'passingPercent' => 70,
                'questions' => [[
                    'q' => 'Which clef is used for higher notes?',
                    'o' => ['Treble', 'Bass'],
                    'a' => 0,
                    'type' => 'multiple',
                ]],
            ])
            ->assertCreated()
            ->assertJsonPath('assessment.assessmentCode', 'A1')
            ->assertJsonPath('assessment.title', 'Music Theory')
            ->json('assessment.id');

        Auth::forgetGuards();
        $secondAssessment = $this->withToken($teacher->createToken('assessments-teacher-2')->plainTextToken)
            ->postJson("/api/classes/{$class->id}/assessments", [
                'title' => 'Music In Practice',
                'passingPercent' => 60,
                'questions' => [[
                    'q' => 'Name the first note of the C major scale.',
                    'answer' => 'C',
                    'type' => 'identification',
                ]],
            ])
            ->assertCreated()
            ->assertJsonPath('assessment.assessmentCode', 'A2')
            ->assertJsonPath('assessment.questions.0.q', 'Name the first note of the C major scale.')
            ->json('assessment.id');

        Auth::forgetGuards();
        $this->withToken($student->createToken('assessments-student-list')->plainTextToken)
            ->getJson("/api/classes/{$class->id}/assessments")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.1.assessmentCode', 'A2');

        Auth::forgetGuards();
        $this->withToken($student->createToken('assessments-student-detail')->plainTextToken)
            ->getJson("/api/assessments/{$secondAssessment}")
            ->assertOk()
            ->assertJsonMissingPath('assessment.questions.0.answer')
            ->assertJsonPath('assessment.questions.0.q', 'Name the first note of the C major scale.');

        Auth::forgetGuards();
        $this->withToken($student->createToken('assessments-student-submit')->plainTextToken)
            ->postJson("/api/assessments/{$secondAssessment}/attempts", ['answers' => ['C']])
            ->assertCreated()
            ->assertJsonPath('attempt.score', 100)
            ->assertJsonPath('attempt.passed', true);

        $this->assertDatabaseHas('module_progress', [
            'user_id' => $student->id,
            'status' => 'in_progress',
        ]);

        Auth::forgetGuards();
        $this->withToken($student->createToken('assessments-student-submit-first')->plainTextToken)
            ->postJson("/api/assessments/{$firstAssessment}/attempts", ['answers' => ['0']])
            ->assertCreated()
            ->assertJsonPath('attempt.passed', true);

        $this->assertDatabaseHas('module_progress', [
            'user_id' => $student->id,
            'status' => 'completed',
        ]);

        $this->assertDatabaseHas('assessment_attempts', [
            'assessment_id' => $secondAssessment,
            'student_id' => $student->id,
            'score' => 100,
        ]);
    }

    private function createUser(string $email, string $role): User
    {
        return User::query()->create([
            'name' => ucfirst($role),
            'email' => $email,
            'password' => bcrypt('Password123!'),
            'role' => $role,
            'status' => 'approved',
        ]);
    }
}

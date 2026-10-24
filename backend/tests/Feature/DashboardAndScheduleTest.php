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

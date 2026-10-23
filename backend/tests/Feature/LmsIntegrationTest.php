<?php

namespace Tests\Feature;

use App\Models\Classroom;
use App\Models\User;
use App\Models\VoiceGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class LmsIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_voice_group_membership_is_many_to_many_with_per_group_voice_parts(): void
    {
        $student = User::query()->create([
            'name' => 'Multi-part Singer',
            'email' => 'multi-part@example.test',
            'role' => 'student',
            'status' => 'approved',
        ]);
        $soprano = VoiceGroup::query()->create(['name' => 'Soprano']);
        $alto = VoiceGroup::query()->create(['name' => 'Alto']);

        $student->voiceGroups()->attach($soprano->id, ['voice_part' => 'Soprano 1']);
        $student->voiceGroups()->attach($alto->id, ['voice_part' => 'Alto 2']);

        $this->assertCount(2, $student->fresh()->voiceGroups);
        $this->assertSame('Soprano 1', $student->fresh()->voiceGroups->firstWhere('id', $soprano->id)->pivot->voice_part);
    }

    public function test_admin_announcements_notify_all_approved_users_by_default(): void
    {
        $admin = $this->createUser('announcement-admin@example.test', 'admin');
        $student = $this->createUser('announcement-student@example.test', 'student');
        $this->createUser('announcement-pending@example.test', 'student', 'pending');

        $this->withToken($admin->createToken('test')->plainTextToken)
            ->postJson('/api/announcements', ['title' => 'System update', 'content' => 'Service update details.'])
            ->assertCreated();

        $this->assertDatabaseCount('notifications', 2);
        $this->assertSame('announcement', $student->fresh()->notifications()->firstOrFail()->data['kind']);
    }

    public function test_teacher_notifications_are_limited_to_students_in_handled_class(): void
    {
        $teacher = $this->createUser('class-teacher@example.test', 'teacher');
        $student = $this->createUser('class-student@example.test', 'student');
        $unrelated = $this->createUser('unrelated-student@example.test', 'student');
        $class = Classroom::query()->create(['name' => 'Teacher class', 'teacher_id' => $teacher->id]);
        $otherClass = Classroom::query()->create(['name' => 'Other class']);
        $class->students()->attach($student->id, ['enrolled_at' => now()]);

        $token = $teacher->createToken('test')->plainTextToken;
        $this->withToken($token)
            ->postJson("/api/classes/{$class->id}/notifications", ['title' => 'Lesson reminder', 'content' => 'Bring your sheet music.'])
            ->assertCreated()
            ->assertJsonPath('notified', 1);

        $this->assertSame(1, $student->fresh()->notifications()->count());
        $this->assertSame(0, $unrelated->fresh()->notifications()->count());
        $studentToken = $student->createToken('test')->plainTextToken;
        $notificationId = $student->fresh()->notifications()->firstOrFail()->id;
        Auth::forgetGuards();
        $response = $this->withToken($studentToken)
            ->getJson('/api/notifications')
            ->assertOk();
        $response->assertJsonPath('data.0.kind', 'class');
        Auth::forgetGuards();
        $this->withToken($studentToken)
            ->patchJson("/api/notifications/{$notificationId}/read")
            ->assertOk()
            ->assertJsonPath('read', true);
        $this->assertNotNull($student->fresh()->notifications()->firstOrFail()->read_at);

        Auth::forgetGuards();
        $this->withToken($token)
            ->postJson("/api/classes/{$otherClass->id}/notifications", ['title' => 'Out of scope', 'content' => 'Not allowed.'])
            ->assertForbidden();
    }

    private function createUser(string $email, string $role, string $status = 'approved'): User
    {
        return User::query()->create([
            'name' => ucfirst($role),
            'email' => $email,
            'password' => bcrypt('Password123!'),
            'role' => $role,
            'status' => $status,
        ]);
    }
}

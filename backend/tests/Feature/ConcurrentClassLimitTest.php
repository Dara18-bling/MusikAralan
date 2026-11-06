<?php

namespace Tests\Feature;

use App\Models\Classroom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConcurrentClassLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_gets_soft_warning_and_cannot_exceed_five_active_enrollments(): void
    {
        $student = $this->createUser('class-limit-student@example.test', 'student');
        $classes = collect(range(1, 6))->map(fn (int $number) => Classroom::query()->create([
            'name' => "Open class {$number}",
            'available_for_enrollment' => true,
        ]));
        $student->classes()->attach(
            $classes->take(3)->mapWithKeys(fn (Classroom $class) => [
                $class->id => ['enrolled_at' => now()],
            ])->all(),
        );
        $token = $student->createToken('class-limit')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/classes/{$classes[3]->id}/enroll")
            ->assertStatus(409)
            ->assertJsonPath('code', 'class_load_warning')
            ->assertJsonPath('enrolledCount', 3);

        $this->withToken($token)
            ->postJson("/api/classes/{$classes[3]->id}/enroll", ['confirmOverload' => true])
            ->assertCreated()
            ->assertJsonPath('enrolledCount', 4);

        $this->withToken($token)
            ->postJson("/api/classes/{$classes[4]->id}/enroll", ['confirmOverload' => true])
            ->assertCreated()
            ->assertJsonPath('enrolledCount', 5);

        $this->withToken($token)
            ->postJson("/api/classes/{$classes[5]->id}/enroll", ['confirmOverload' => true])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'class_load_hard_limit');

        $this->assertSame(5, $student->fresh()->classes()->where('classes.deleted', false)->count());
    }

    public function test_admin_gets_teacher_load_warning_and_hard_limit_applies_to_active_classes(): void
    {
        $admin = $this->createUser('class-limit-admin@example.test', 'admin');
        $teacher = $this->createUser('class-limit-teacher@example.test', 'teacher');
        foreach (range(1, 3) as $number) {
            Classroom::query()->create([
                'name' => "Assigned class {$number}",
                'teacher_id' => $teacher->id,
            ]);
        }
        $token = $admin->createToken('teacher-class-limit')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/classes', [
                'name' => 'Fourth assigned class',
                'teacher' => $teacher->name,
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'class_load_warning')
            ->assertJsonPath('classCount', 3);

        $this->withToken($token)
            ->postJson('/api/classes', [
                'name' => 'Fourth assigned class',
                'teacher' => $teacher->name,
                'confirmOverload' => true,
            ])
            ->assertCreated();

        $this->withToken($token)
            ->postJson('/api/classes', [
                'name' => 'Fifth assigned class',
                'teacher' => $teacher->name,
                'confirmOverload' => true,
            ])
            ->assertCreated();

        $this->withToken($token)
            ->postJson('/api/classes', [
                'name' => 'Sixth assigned class',
                'teacher' => $teacher->name,
                'confirmOverload' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'class_load_hard_limit');

        $this->assertSame(
            5,
            Classroom::query()->where('teacher_id', $teacher->id)->where('deleted', false)->count(),
        );
    }

    public function test_updating_or_restoring_a_class_checks_teacher_load(): void
    {
        $admin = $this->createUser('class-update-admin@example.test', 'admin');
        $teacher = $this->createUser('class-update-teacher@example.test', 'teacher');
        foreach (range(1, 3) as $number) {
            Classroom::query()->create([
                'name' => "Existing class {$number}",
                'teacher_id' => $teacher->id,
            ]);
        }
        $unassigned = Classroom::query()->create(['name' => 'Unassigned class']);
        $token = $admin->createToken('teacher-class-update-limit')->plainTextToken;

        $this->withToken($token)
            ->putJson("/api/classes/{$unassigned->id}", ['teacher' => $teacher->name])
            ->assertStatus(409)
            ->assertJsonPath('code', 'class_load_warning');

        $this->withToken($token)
            ->putJson("/api/classes/{$unassigned->id}", [
                'teacher' => $teacher->name,
                'confirmOverload' => true,
            ])
            ->assertOk();

        Classroom::query()->create([
            'name' => 'Fifth active class',
            'teacher_id' => $teacher->id,
        ]);
        $deleted = Classroom::query()->create([
            'name' => 'Deleted class',
            'teacher_id' => $teacher->id,
            'deleted' => true,
        ]);
        $this->withToken($token)
            ->putJson("/api/classes/{$deleted->id}", ['deleted' => false])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'class_load_hard_limit');
    }

    private function createUser(string $email, string $role): User
    {
        return User::query()->create([
            'name' => ucfirst($role).' User',
            'email' => $email,
            'password' => bcrypt('Password123!'),
            'role' => $role,
            'status' => 'approved',
        ]);
    }
}

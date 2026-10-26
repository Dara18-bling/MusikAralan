<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\LearningController;
use App\Models\Assessment;
use App\Models\Classroom;
use App\Models\Material;
use App\Models\QuizAttempt;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword as ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RelationalSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_classes_enrollments_materials_and_assessments_are_relational(): void
    {
        $teacher = User::query()->create([
            'firebase_uid' => 'teacher-test',
            'name' => 'Choir Teacher',
            'email' => 'teacher@example.test',
            'role' => 'teacher',
            'status' => 'approved',
        ]);
        $student = User::query()->create([
            'firebase_uid' => 'student-test',
            'name' => 'Choir Student',
            'email' => 'student@example.test',
            'role' => 'student',
            'status' => 'approved',
        ]);
        $class = Classroom::query()->create([
            'name' => 'Music Theory',
            'teacher_id' => $teacher->id,
            'age_group' => 'all',
            'available_for_enrollment' => true,
        ]);
        $class->students()->attach($student->id, ['enrolled_at' => now()]);
        $material = Material::query()->create([
            'class_id' => $class->id,
            'teacher_id' => $teacher->id,
            'title' => 'Lesson one',
            'description' => 'Read the notes.',
            'kind' => 'Module',
        ]);
        $assessment = Assessment::query()->create([
            'class_id' => $class->id,
            'title' => 'Lesson one quiz',
            'passing_percent' => 70,
        ]);
        $assessment->questions()->create([
            'position' => 0,
            'prompt' => 'Which note is this?',
            'type' => 'multiple',
            'options' => ['A', 'B'],
            'correct_option_index' => 1,
        ]);

        $this->assertSame($student->id, $class->students()->first()->id);
        $this->assertSame($teacher->id, $class->teacher->id);
        $this->assertSame($class->id, $material->classroom->id);
        $this->assertSame(1, $assessment->questions()->count());
    }

    public function test_api_requires_a_sanctum_token(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_login_issues_a_sanctum_token_and_logout_revokes_it(): void
    {
        $user = User::query()->create([
            'name' => 'Sanctum Student',
            'email' => 'sanctum@example.test',
            'password' => Hash::make('Password123!'),
            'role' => 'student',
            'status' => 'approved',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ])->assertOk()->assertJsonPath('user.id', (string) $user->id);

        $token = $response->json('token');
        $this->withToken($token)->getJson('/api/me')->assertOk();
        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);
        Auth::forgetGuards();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_pending_accounts_cannot_receive_api_tokens(): void
    {
        $user = User::query()->create([
            'name' => 'Pending Student',
            'email' => 'pending@example.test',
            'password' => Hash::make('Password123!'),
            'role' => 'student',
            'status' => 'pending',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ])->assertForbidden()->assertJsonPath('status', 'pending');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_registration_stores_a_hashed_password_and_pending_account(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'New Student',
            'email' => 'new-student@example.test',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'birthday' => '2000-01-01',
            'phoneNumber' => '09171234567',
        ])->assertCreated()->assertJsonPath('user.status', 'pending');

        $user = User::query()->where('email', 'new-student@example.test')->firstOrFail();
        $this->assertNotSame('Password123!', $user->password);
        $this->assertTrue(Hash::check('Password123!', $user->password));
    }

    public function test_password_reset_changes_the_password_and_revokes_existing_tokens(): void
    {
        Notification::fake();
        $user = User::query()->create([
            'name' => 'Reset Student',
            'email' => 'reset@example.test',
            'password' => Hash::make('OldPassword123!'),
            'role' => 'student',
            'status' => 'approved',
        ]);
        $user->createToken('test');

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertJsonPath('message', 'If an account exists for that email, a password reset link has been sent.');

        $resetToken = null;
        Notification::assertSentTo($user, ResetPasswordNotification::class, function ($notification) use (&$resetToken): bool {
            $resetToken = $notification->token;

            return true;
        });
        $this->assertIsString($resetToken);

        $this->postJson('/api/auth/reset-password', [
            'token' => $resetToken,
            'email' => $user->email,
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ])->assertOk();

        $this->assertTrue(Hash::check('NewPassword123!', $user->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_default_appearance_is_available_without_sign_in(): void
    {
        $this->getJson('/api/settings/appearance')
            ->assertOk()
            ->assertExactJson(['appearance' => null]);
    }

    public function test_local_database_seeder_creates_demo_accounts_and_catalog_data(): void
    {
        $this->seed();
        $this->seed();

        $this->assertDatabaseHas('users', [
            'email' => 'admin@musik.test',
            'role' => 'admin',
            'status' => 'approved',
        ]);
        $this->assertDatabaseHas('users', [
            'email' => 'teacher@musik.test',
            'role' => 'teacher',
        ]);
        $this->assertDatabaseHas('users', [
            'email' => 'student@musik.test',
            'role' => 'student',
        ]);
        $this->assertDatabaseHas('classes', ['name' => 'Basic Keyboard Lessons']);
        $this->assertDatabaseHas('chatbot_responses', ['legacy_key' => 'join-class']);
        $this->assertDatabaseCount('voice_groups', 4);
        $this->assertDatabaseCount('classes', 7);
        $this->assertDatabaseCount('modules', 7);
        $this->assertDatabaseCount('materials', 21);
        $this->assertDatabaseCount('assessments', 7);
        $this->assertDatabaseCount('assessment_questions', 28);
        $this->assertDatabaseCount('schedule_events', 7);
        $this->assertDatabaseCount('announcements', 3);
        $this->assertDatabaseCount('settings', 1);
        $this->assertGreaterThan(20, DB::table('enrollments')->count());
        $this->assertGreaterThan(0, DB::table('module_progress')->count());
        $this->assertGreaterThan(0, DB::table('assessment_attempt_answers')->count());
        $this->assertGreaterThan(0, DB::table('material_completions')->count());
        $this->assertGreaterThan(0, DB::table('practice_sessions')->count());
        $this->assertDatabaseCount('notifications', 2);

        $student = User::query()->where('email', 'student@musik.test')->firstOrFail();
        $this->assertGreaterThan(0, $student->classes()->count());
        $this->assertGreaterThan(0, $student->voiceGroups()->count());
        $this->assertGreaterThan(0, $student->moduleProgress()->count());

        $this->postJson('/api/auth/login', [
            'email' => 'admin@musik.test',
            'password' => 'Password123!',
        ])->assertOk()->assertJsonPath('user.role', 'admin');
    }

    public function test_students_cannot_read_answer_keys_and_the_api_grades_attempts(): void
    {
        $student = User::query()->create([
            'firebase_uid' => 'student-assessment',
            'name' => 'Assessment Student',
            'email' => 'assessment@example.test',
            'role' => 'student',
            'status' => 'approved',
        ]);
        $class = Classroom::query()->create([
            'name' => 'Assessment Class',
            'age_group' => 'all',
            'available_for_enrollment' => true,
        ]);
        $class->students()->attach($student->id, ['enrolled_at' => now()]);
        $assessment = $class->assessments()->create([
            'assessment_code' => 'A1',
            'title' => 'Private answer key',
            'passing_percent' => 70,
        ]);
        $assessment->questions()->create([
            'position' => 0,
            'prompt' => 'Select the correct answer.',
            'type' => 'multiple',
            'options' => ['Wrong', 'Correct'],
            'correct_option_index' => 1,
        ]);

        $controller = new LearningController;
        $readRequest = Request::create('/api/classes/'.$class->id.'/assessment');
        $readRequest->attributes->set('app_user', $student);
        $assessmentResponse = $controller->assessment($readRequest, $class)->getData(true)['assessment'];
        $this->assertArrayNotHasKey('a', $assessmentResponse['questions'][0]);
        $this->assertArrayNotHasKey('answer', $assessmentResponse['questions'][0]);

        $submitRequest = Request::create('/api/classes/'.$class->id.'/assessment/attempts', 'POST', [
            'answers' => ['1'],
        ]);
        $submitRequest->attributes->set('app_user', $student);
        $attemptResponse = $controller->submitAssessment($submitRequest, $class)->getData(true)['attempt'];

        $this->assertSame(100, $attemptResponse['score']);
        $this->assertTrue($attemptResponse['passed']);
        $this->assertDatabaseHas('assessment_attempts', [
            'assessment_id' => $assessment->id,
            'student_id' => $student->id,
            'score' => 100,
            'passed' => true,
            'status' => 'passed',
        ]);
        $attempt = QuizAttempt::query()->where('assessment_id', $assessment->id)->firstOrFail();
        $this->assertNotNull($attempt->module_progress_id);
        $this->assertSame('completed', $attempt->moduleProgress->status);
    }
}

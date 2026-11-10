<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAccountsPaginationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_accounts_endpoint_returns_ten_filtered_accounts_per_page(): void
    {
        $admin = $this->createUser('accounts-admin@example.test', 'admin', 'approved');
        foreach (range(1, 23) as $number) {
            $this->createUser(
                "student{$number}@example.test",
                'student',
                $number <= 18 ? 'approved' : 'pending',
            );
        }
        $token = $admin->createToken('accounts-pagination')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/admin/users?filter=all&page=1')
            ->assertOk()
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('currentPage', 1)
            ->assertJsonPath('lastPage', 3)
            ->assertJsonPath('perPage', 10)
            ->assertJsonPath('total', 24);

        $this->withToken($token)
            ->getJson('/api/admin/users?filter=pending&page=2')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('currentPage', 2)
            ->assertJsonPath('lastPage', 1)
            ->assertJsonPath('total', 5);

        $this->withToken($token)
            ->getJson('/api/admin/users?filter=teacher')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('total', 0);
    }

    public function test_admin_summary_returns_pending_count_and_active_teachers(): void
    {
        $admin = $this->createUser('summary-admin@example.test', 'admin', 'approved');
        $this->createUser('summary-pending@example.test', 'student', 'pending');
        $this->createUser('summary-teacher@example.test', 'teacher', 'approved');
        $this->createUser('summary-inactive-teacher@example.test', 'teacher', 'inactive');

        $this->withToken($admin->createToken('accounts-summary')->plainTextToken)
            ->getJson('/api/admin/users/summary')
            ->assertOk()
            ->assertJsonPath('pendingCount', 1)
            ->assertJsonCount(1, 'pendingRequests')
            ->assertJsonCount(1, 'teachers')
            ->assertJsonPath('teachers.0', 'Teacher User');
    }

    public function test_admin_can_edit_account_profile_and_contact_details(): void
    {
        $admin = $this->createUser('edit-admin@example.test', 'admin', 'approved');
        $target = $this->createUser('edit-target@example.test', 'student', 'approved');
        $teacher = $this->createUser('edit-teacher@example.test', 'teacher', 'approved');
        $target->update(['birth_year' => 1995]);
        $token = $admin->createToken('edit-account')->plainTextToken;

        $this->withToken($token)
            ->patchJson("/api/admin/users/{$target->id}", [
                'name' => 'Updated Student',
                'email' => 'updated-student@example.test',
                'birthday' => '1995-08-21',
                'phoneNumber' => '+639171234567',
                'messengerLink' => 'https://m.me/updatedstudent',
            ])
            ->assertOk()
            ->assertJsonPath('user.name', 'Updated Student')
            ->assertJsonPath('user.email', 'updated-student@example.test')
            ->assertJsonPath('user.birthday', '1995-08-21')
            ->assertJsonPath('user.birthYear', 1995)
            ->assertJsonPath('user.phoneNumber', '+639171234567')
            ->assertJsonPath('user.messengerLink', 'https://m.me/updatedstudent')
            ->assertJsonPath('user.role', 'student')
            ->assertJsonPath('user.status', 'approved');

        $this->assertSame('updated-student@example.test', $target->fresh()->email);
        $this->withToken($admin->createToken('duplicate-email')->plainTextToken)
            ->patchJson("/api/admin/users/{$target->id}", [
                'email' => $admin->email,
            ])
            ->assertUnprocessable();

        $this->withToken($admin->createToken('edit-teacher-without-expiry')->plainTextToken)
            ->patchJson("/api/admin/users/{$teacher->id}", [
                'name' => 'Teacher Updated',
            ])
            ->assertOk()
            ->assertJsonPath('user.name', 'Teacher Updated');
    }

    private function createUser(string $email, string $role, string $status): User
    {
        return User::query()->create([
            'name' => ucfirst($role).' User',
            'email' => $email,
            'password' => bcrypt('Password123!'),
            'role' => $role,
            'status' => $status,
        ]);
    }
}

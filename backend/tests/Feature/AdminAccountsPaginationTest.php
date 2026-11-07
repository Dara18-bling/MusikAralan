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

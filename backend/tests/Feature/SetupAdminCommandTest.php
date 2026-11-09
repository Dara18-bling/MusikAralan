<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SetupAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_the_first_approved_admin_with_a_hashed_password(): void
    {
        $this->artisan('musik:setup-admin')
            ->expectsQuestion('Admin name', 'First Admin')
            ->expectsQuestion('Admin email', 'ADMIN@example.test')
            ->expectsQuestion('Password', 'StrongPassword123!')
            ->expectsQuestion('Confirm password', 'StrongPassword123!')
            ->expectsOutputToContain('Administrator account created for admin@example.test.')
            ->assertExitCode(0);

        $admin = User::query()->sole();

        $this->assertSame('First Admin', $admin->name);
        $this->assertSame('admin@example.test', $admin->email);
        $this->assertSame('admin', $admin->role);
        $this->assertSame('approved', $admin->status);
        $this->assertNotNull($admin->approved_at);
        $this->assertNull($admin->approved_by);
        $this->assertTrue(Hash::check('StrongPassword123!', $admin->password));
    }

    public function test_it_refuses_to_run_after_any_user_exists(): void
    {
        User::query()->create([
            'name' => 'Existing User',
            'email' => 'existing@example.test',
            'password' => Hash::make('Password123!'),
            'role' => 'student',
            'status' => 'approved',
        ]);

        $this->artisan('musik:setup-admin')
            ->expectsOutputToContain('Setup is only available before the first user account has been created.')
            ->assertExitCode(1);

        $this->assertSame(1, User::query()->count());
    }
}

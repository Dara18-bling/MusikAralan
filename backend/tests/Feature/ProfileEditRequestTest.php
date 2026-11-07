<?php

namespace Tests\Feature;

use App\Models\ProfileEditRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class ProfileEditRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_profile_changes_only_apply_after_admin_approval(): void
    {
        $user = $this->createUser('profile-user@example.test', 'student');
        $admin = $this->createUser('profile-admin@example.test', 'admin');

        $requestId = $this->withToken($user->createToken('profile-edit')->plainTextToken)
            ->postJson('/api/me/profile-edit-requests', [
                'name' => 'Updated Profile User',
                'email' => 'updated-profile@example.test',
                'birthday' => '1998-06-12',
                'phoneNumber' => '09171234567',
                'messengerLink' => 'https://m.me/profileuser',
            ])
            ->assertCreated()
            ->assertJsonPath('request.status', 'pending')
            ->json('request.id');

        $this->assertSame('Profile User', $user->fresh()->name);
        $this->assertSame('profile-user@example.test', $user->fresh()->email);
        $this->assertNull($user->fresh()->birthday);
        $this->assertNull($user->fresh()->phone_number);

        $this->withToken($user->createToken('profile-pending')->plainTextToken)
            ->getJson('/api/me/profile-edit-request')
            ->assertOk()
            ->assertJsonPath('request.id', $requestId)
            ->assertJsonPath('request.changes.name', 'Updated Profile User');

        $this->withToken($user->createToken('profile-duplicate')->plainTextToken)
            ->postJson('/api/me/profile-edit-requests', ['name' => 'Another Name'])
            ->assertStatus(409);

        Auth::forgetGuards();
        $this->withToken($admin->createToken('profile-review')->plainTextToken)
            ->getJson('/api/admin/profile-edit-requests')
            ->assertOk()
            ->assertJsonPath('data.0.userId', (string) $user->id)
            ->assertJsonPath('data.0.current.name', 'Profile User')
            ->assertJsonPath('data.0.changes.email', 'updated-profile@example.test');

        Auth::forgetGuards();
        $this->withToken($admin->createToken('profile-approve')->plainTextToken)
            ->patchJson("/api/admin/profile-edit-requests/{$requestId}", [
                'decision' => 'approved',
            ])
            ->assertOk()
            ->assertJsonPath('request.status', 'approved');

        $this->assertSame('Updated Profile User', $user->fresh()->name);
        $this->assertSame('updated-profile@example.test', $user->fresh()->email);
        $this->assertSame('1998-06-12', $user->fresh()->birthday->format('Y-m-d'));
        $this->assertSame(1998, $user->fresh()->birth_year);
        $this->assertSame('09171234567', $user->fresh()->phone_number);
        $this->assertSame('https://m.me/profileuser', $user->fresh()->messenger_link);
        $this->assertSame('approved', ProfileEditRequest::query()->findOrFail($requestId)->status);

        Auth::forgetGuards();
        $this->withToken($user->createToken('profile-approved-result')->plainTextToken)
            ->getJson('/api/me/profile-edit-request')
            ->assertOk()
            ->assertJsonPath('request.status', 'approved');
    }

    public function test_rejected_request_does_not_change_account_and_users_cannot_bypass_review(): void
    {
        $user = $this->createUser('profile-reject-user@example.test', 'teacher');
        $admin = $this->createUser('profile-reject-admin@example.test', 'admin');
        $token = $user->createToken('profile-reject')->plainTextToken;

        $this->withToken($token)
            ->patchJson('/api/me', ['name' => 'Bypass Attempt'])
            ->assertForbidden();
        $this->withToken($token)
            ->patchJson('/api/me/contact-details', [
                'phoneNumber' => '09171234567',
                'messengerLink' => null,
            ])
            ->assertForbidden();

        $requestId = $this->withToken($token)
            ->postJson('/api/me/profile-edit-requests', ['name' => 'Rejected Name'])
            ->assertCreated()
            ->json('request.id');

        Auth::forgetGuards();
        $this->withToken($admin->createToken('profile-reject-review')->plainTextToken)
            ->patchJson("/api/admin/profile-edit-requests/{$requestId}", [
                'decision' => 'rejected',
            ])
            ->assertOk()
            ->assertJsonPath('request.status', 'rejected');

        $this->assertSame('Profile User', $user->fresh()->name);
        $this->assertSame('rejected', ProfileEditRequest::query()->findOrFail($requestId)->status);

        Auth::forgetGuards();
        $this->withToken($user->createToken('profile-rejected-result')->plainTextToken)
            ->getJson('/api/me/profile-edit-request')
            ->assertOk()
            ->assertJsonPath('request.status', 'rejected');
    }

    public function test_admin_can_update_their_own_birthday_directly(): void
    {
        $admin = $this->createUser('profile-admin-birthday@example.test', 'admin');

        $this->withToken($admin->createToken('admin-birthday')->plainTextToken)
            ->patchJson('/api/me', [
                'name' => 'Profile User',
                'birthday' => '1985-04-03',
            ])
            ->assertOk()
            ->assertJsonPath('user.birthday', '1985-04-03')
            ->assertJsonPath('user.birthYear', 1985);
    }

    private function createUser(string $email, string $role): User
    {
        return User::query()->create([
            'name' => 'Profile User',
            'email' => $email,
            'password' => bcrypt('Password123!'),
            'role' => $role,
            'status' => 'approved',
        ]);
    }
}

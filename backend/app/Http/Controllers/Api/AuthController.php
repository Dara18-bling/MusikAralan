<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function session(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');

        return response()->json([
            'user' => $user ? $this->userPayload($user) : null,
        ]);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);
        $user = User::query()->whereRaw('LOWER(email) = ?', [strtolower($data['email'])])->first();

        if (! $user || ! $user->password || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'The email or password is incorrect.'], 401);
        }
        if ($user->status !== 'approved') {
            return response()->json([
                'message' => $user->status === 'pending'
                    ? 'Your account is still pending admin approval.'
                    : 'This account is not approved for access.',
                'status' => $user->status,
            ], 403);
        }

        $token = $user->createToken('frontend', ['*'], now()->addHours(12));

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => $this->userPayload($user),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed', 'regex:/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/'],
            'birthday' => ['required', 'date', 'before_or_equal:2021-12-31', 'after_or_equal:1920-01-01'],
            'phoneNumber' => ['required', 'regex:/^\\d{11}$/'],
            'messengerLink' => ['nullable', 'string', 'max:2048'],
        ]);

        $user = User::query()->create([
            'name' => trim($data['name']),
            'email' => strtolower($data['email']),
            'password' => Hash::make($data['password']),
            'birthday' => $data['birthday'],
            'birth_year' => (int) substr($data['birthday'], 0, 4),
            'phone_number' => $data['phoneNumber'],
            'messenger_link' => $data['messengerLink'] ?? null,
            'role' => 'student',
            'status' => 'pending',
            'date_requested' => now(),
        ]);

        return response()->json(['user' => $this->userPayload($user)], 201);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['loggedOut' => true]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink(['email' => strtolower($request->string('email')->toString())]);

        return response()->json([
            'message' => 'If an account exists for that email, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed', 'regex:/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/'],
        ]);
        $status = Password::reset(
            $data,
            function (User $user, string $password): void {
                $user->forceFill(['password' => Hash::make($password)])->save();
                $user->tokens()->delete();
            },
        );

        return response()->json([
            'message' => __($status),
        ], $status === Password::PASSWORD_RESET ? 200 : 422);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->userPayload($request->attributes->get('app_user'))]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);
        $user->name = trim($data['name']);
        $user->save();

        return response()->json(['user' => $this->userPayload($user)]);
    }

    public function updatePhone(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $data = $request->validate([
            'phoneNumber' => ['required', 'regex:/^(?:\\d{11}|\\+[1-9]\\d{7,14})$/'],
        ]);
        if ($user->phone_number !== $data['phoneNumber']) {
            $user->phone_verified = false;
        }
        $user->phone_number = $data['phoneNumber'];
        $user->save();

        return response()->json(['user' => $this->userPayload($user)]);
    }

    public function indexUsers(): JsonResponse
    {
        $users = User::query()->orderByDesc('date_requested')->get()
            ->map(fn (User $user) => $this->userPayload($user));

        return response()->json(['data' => $users]);
    }

    public function updateUser(Request $request, int $userId): JsonResponse
    {
        $target = User::query()->findOrFail($userId);
        $data = $request->validate([
            'status' => ['required', Rule::in(['pending', 'approved', 'rejected', 'inactive'])],
            'role' => ['sometimes', Rule::in(['student', 'teacher', 'admin'])],
            'accessUntil' => ['nullable', 'date'],
        ]);

        if ($data['status'] === 'approved' && ($data['role'] ?? $target->role) === 'teacher' && empty($data['accessUntil']) && ! $target->access_until) {
            return response()->json(['message' => 'An access end date is required to approve a teacher account.'], 422);
        }

        $target->status = $data['status'];
        if ($data['status'] === 'approved' && isset($data['role'])) {
            $target->role = $data['role'];
        }
        if (array_key_exists('accessUntil', $data) && $data['accessUntil'] !== null) {
            $target->access_until = $data['accessUntil'];
        }
        $target->save();

        return response()->json(['user' => $this->userPayload($target)]);
    }

    public function userPayload(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'birthday' => $user->birthday?->format('Y-m-d'),
            'birthYear' => $user->birth_year,
            'phoneNumber' => $user->phone_number,
            'phoneVerified' => $user->phone_verified,
            'messengerLink' => $user->messenger_link,
            'role' => $user->role,
            'status' => $user->status,
            'accessUntil' => $user->access_until?->format('Y-m-d'),
            'dateRequested' => $user->date_requested?->toISOString(),
        ];
    }
}

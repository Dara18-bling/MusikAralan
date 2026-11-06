<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\PasswordResetCodeNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
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
        $data = $request->validate(['email' => ['required', 'email', 'max:255']]);
        $email = strtolower(trim($data['email']));
        $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();

        if ($user) {
            $this->sendPasswordResetCode($user);
        }

        return response()->json([
            'message' => 'If an account exists for that email, a verification code has been sent.',
        ]);
    }

    public function sendPasswordChangeCode(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $this->sendPasswordResetCode($user);

        return response()->json([
            'message' => 'Password reset instructions have been sent to your account email.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'size:8', 'alpha_num'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed', 'regex:/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/'],
        ]);
        $email = strtolower(trim($data['email']));
        $status = DB::transaction(function () use ($data, $email): bool {
            $user = User::query()
                ->whereRaw('LOWER(email) = ?', [$email])
                ->first();
            if (! $user) {
                return false;
            }

            $reset = DB::table('password_reset_tokens')
                ->where('email', $user->email)
                ->lockForUpdate()
                ->first();
            if (
                ! $reset
                || ! $reset->created_at
                || now()->greaterThan(
                    Carbon::parse($reset->created_at)
                        ->addMinutes((int) config('auth.passwords.users.expire', 15)),
                )
                || ! Hash::check($data['code'], $reset->token)
            ) {
                return false;
            }

            $user->forceFill(['password' => Hash::make($data['password'])])->save();
            $user->tokens()->delete();
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();

            return true;
        });

        if (! $status) {
            return response()->json([
                'message' => 'The verification code is invalid or has expired.',
            ], 422);
        }

        return response()->json(['message' => 'Your password has been reset.']);
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
            'birthday' => ['sometimes', 'nullable', 'date', 'before_or_equal:today', 'after_or_equal:1920-01-01'],
        ]);
        $user->name = trim($data['name']);
        if (array_key_exists('birthday', $data)) {
            $user->birthday = $data['birthday'];
            $user->birth_year = $data['birthday'] === null
                ? null
                : (int) substr($data['birthday'], 0, 4);
        }
        $user->save();

        return response()->json(['user' => $this->userPayload($user)]);
    }

    public function updateContactDetails(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $data = $request->validate([
            'phoneNumber' => ['present', 'nullable', 'regex:/^(?:\\d{11}|\\+[1-9]\\d{7,14})$/'],
            'messengerLink' => ['present', 'nullable', 'string', 'max:2048'],
        ]);
        $user->phone_number = $data['phoneNumber'];
        $user->messenger_link = $data['messengerLink'];
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
        if ($data['status'] === 'approved' && $target->status !== 'approved') {
            $target->approved_by = $request->attributes->get('app_user')->id;
            $target->approved_at = now();
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
            'messengerLink' => $user->messenger_link,
            'role' => $user->role,
            'status' => $user->status,
            'approvedBy' => $user->approved_by === null ? null : (string) $user->approved_by,
            'approvedAt' => $user->approved_at?->toISOString(),
            'accessUntil' => $user->access_until?->format('Y-m-d'),
            'dateRequested' => $user->date_requested?->toISOString(),
        ];
    }

    private function sendPasswordResetCode(User $user): void
    {
        $code = Str::upper(Str::random(8));
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            [
                'token' => Hash::make($code),
                'created_at' => now(),
            ],
        );
        $user->notify(new PasswordResetCodeNotification($code));
    }
}

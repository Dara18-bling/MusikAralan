<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProfileChangeRequestController extends Controller
{
    public function mine(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $changeRequest = DB::table('user_profile_change_requests')
            ->where('user_id', $user->id)
            ->latest('id')
            ->first();

        return response()->json(['request' => $changeRequest ? [
            'id' => (string) $changeRequest->id,
            'status' => $changeRequest->status,
            'submittedAt' => $changeRequest->created_at,
            'reviewNote' => $changeRequest->review_note,
        ] : null]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $pendingExists = DB::table('user_profile_change_requests')
            ->where('user_id', $user->id)
            ->where('status', 'pending')
            ->exists();

        if ($pendingExists) {
            return response()->json(['message' => 'You already have a profile change request awaiting review.'], 409);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'birthday' => ['sometimes', 'nullable', 'date', 'before_or_equal:2021-12-31', 'after_or_equal:1920-01-01'],
            'phoneNumber' => ['sometimes', 'nullable', 'regex:/^\d{11}$/'],
            'messengerLink' => ['sometimes', 'nullable', 'url', 'max:2048'],
        ]);

        $id = DB::table('user_profile_change_requests')->insertGetId([
            'user_id' => $user->id,
            'proposed_data' => json_encode([
                ...$data,
                ...(array_key_exists('name', $data) && is_string($data['name']) ? ['name' => trim($data['name'])] : []),
                ...(array_key_exists('messengerLink', $data) ? ['messengerLink' => $data['messengerLink']] : []),
            ], JSON_THROW_ON_ERROR),
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['request' => ['id' => (string) $id, 'status' => 'pending']], 201);
    }

    public function index(): JsonResponse
    {
        $rows = DB::table('user_profile_change_requests as requests')
            ->join('users', 'users.id', '=', 'requests.user_id')
            ->where('requests.status', 'pending')
            ->orderBy('requests.created_at')
            ->select([
                'requests.id', 'requests.proposed_data', 'requests.created_at',
                'users.id as user_id', 'users.name as user_name', 'users.email as user_email',
                'users.role as user_role', 'users.birthday as user_birthday',
                'users.phone_number as user_phone_number', 'users.messenger_link as user_messenger_link',
            ])
            ->get()
            ->map(fn (object $row): array => [
                'id' => (string) $row->id,
                'submittedAt' => $row->created_at,
                'current' => [
                    'id' => (string) $row->user_id,
                    'name' => $row->user_name,
                    'email' => $row->user_email,
                    'role' => $row->user_role,
                    'birthday' => $row->user_birthday,
                    'phoneNumber' => $row->user_phone_number,
                    'messengerLink' => $row->user_messenger_link,
                ],
                'proposed' => [
                    ...(json_decode($row->proposed_data, true) ?: []),
                    'email' => $row->user_email,
                ],
            ]);

        return response()->json(['data' => $rows]);
    }

    public function review(Request $request, int $requestId): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
            'reviewNote' => ['nullable', 'string', 'max:1000'],
        ]);

        $result = DB::transaction(function () use ($request, $requestId, $data): array {
            $changeRequest = DB::table('user_profile_change_requests')
                ->where('id', $requestId)
                ->lockForUpdate()
                ->first();
            abort_unless($changeRequest, 404, 'Profile change request not found.');
            abort_unless($changeRequest->status === 'pending', 409, 'This request has already been reviewed.');

            $user = User::query()->lockForUpdate()->findOrFail($changeRequest->user_id);
            $proposed = json_decode($changeRequest->proposed_data, true) ?: [];

            if ($data['status'] === 'approved') {
                if (array_key_exists('name', $proposed) && trim((string) $proposed['name']) !== '') {
                    $user->name = trim((string) $proposed['name']);
                }
                if (array_key_exists('birthday', $proposed)) {
                    $user->birthday = $proposed['birthday'];
                    $user->birth_year = $user->birthday ? (int) substr((string) $user->birthday, 0, 4) : null;
                }
                if (array_key_exists('phoneNumber', $proposed)) {
                    if ($user->phone_number !== $proposed['phoneNumber']) {
                        $user->phone_verified = false;
                    }
                    $user->phone_number = $proposed['phoneNumber'];
                }
                if (array_key_exists('messengerLink', $proposed)) {
                    $user->messenger_link = $proposed['messengerLink'];
                }
                $user->save();
            }

            DB::table('user_profile_change_requests')->where('id', $requestId)->update([
                'status' => $data['status'],
                'review_note' => $data['reviewNote'] ?? null,
                'reviewed_by' => $request->attributes->get('app_user')->id,
                'reviewed_at' => now(),
                'updated_at' => now(),
            ]);

            return ['id' => (string) $requestId, 'status' => $data['status']];
        });

        return response()->json(['request' => $result]);
    }
}

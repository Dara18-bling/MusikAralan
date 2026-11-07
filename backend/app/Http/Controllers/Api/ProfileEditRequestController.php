<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProfileEditRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ProfileEditRequestController extends Controller
{
    public function current(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $editRequest = ProfileEditRequest::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->first();

        return response()->json([
            'request' => $editRequest ? $this->payload($editRequest->load('user')) : null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        abort_unless($user->role !== 'admin', 403, 'Administrators can update their own profile directly.');

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'birthday' => ['sometimes', 'nullable', 'date', 'before_or_equal:today', 'after_or_equal:1920-01-01'],
            'phoneNumber' => ['sometimes', 'nullable', 'regex:/^(?:\\d{11}|\\+[1-9]\\d{7,14})$/'],
            'messengerLink' => ['sometimes', 'nullable', 'string', 'max:2048'],
        ]);
        if ($data === []) {
            return response()->json(['message' => 'Make at least one profile change before submitting.'], 422);
        }

        $editRequest = DB::transaction(function () use ($data, $user): ?ProfileEditRequest {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $existing = ProfileEditRequest::query()
                ->where('user_id', $user->id)
                ->where('status', 'pending')
                ->lockForUpdate()
                ->first();
            if ($existing) {
                return null;
            }

            return ProfileEditRequest::query()->create([
                'user_id' => $user->id,
                'changes' => $data,
                'status' => 'pending',
            ]);
        });

        if (! $editRequest) {
            return response()->json([
                'message' => 'You already have a profile edit request awaiting review.',
            ], 409);
        }

        return response()->json([
            'request' => $this->payload($editRequest->load('user')),
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $requests = ProfileEditRequest::query()
            ->with('user')
            ->where('status', 'pending')
            ->orderBy('created_at')
            ->orderBy('id')
            ->paginate(10, ['*'], 'page', $data['page'] ?? 1);

        return response()->json([
            'data' => $requests->getCollection()
                ->map(fn (ProfileEditRequest $editRequest): array => $this->payload($editRequest))
                ->values(),
            'currentPage' => $requests->currentPage(),
            'lastPage' => max(1, $requests->lastPage()),
            'perPage' => $requests->perPage(),
            'total' => $requests->total(),
        ]);
    }

    public function review(Request $request, int $requestId): JsonResponse
    {
        $admin = $request->attributes->get('app_user');
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
        ]);

        $result = DB::transaction(function () use ($admin, $data, $requestId): array {
            $editRequest = ProfileEditRequest::query()
                ->whereKey($requestId)
                ->lockForUpdate()
                ->firstOrFail();
            if ($editRequest->status !== 'pending') {
                return ['conflict' => true];
            }
            $user = User::query()->whereKey($editRequest->user_id)->lockForUpdate()->firstOrFail();

            if ($data['decision'] === 'approved') {
                $validator = Validator::make(
                    $editRequest->changes,
                    [
                        'name' => ['sometimes', 'required', 'string', 'max:255'],
                        'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
                        'birthday' => ['sometimes', 'nullable', 'date', 'before_or_equal:today', 'after_or_equal:1920-01-01'],
                        'phoneNumber' => ['sometimes', 'nullable', 'regex:/^(?:\\d{11}|\\+[1-9]\\d{7,14})$/'],
                        'messengerLink' => ['sometimes', 'nullable', 'string', 'max:2048'],
                    ],
                );
                if ($validator->fails()) {
                    return ['invalid' => true, 'errors' => $validator->errors()->toArray()];
                }

                $changes = $validator->validated();
                if (array_key_exists('name', $changes)) {
                    $user->name = trim($changes['name']);
                }
                if (array_key_exists('email', $changes)) {
                    $user->email = strtolower($changes['email']);
                }
                if (array_key_exists('birthday', $changes)) {
                    $user->birthday = $changes['birthday'];
                    $user->birth_year = $changes['birthday'] === null
                        ? null
                        : (int) substr($changes['birthday'], 0, 4);
                }
                if (array_key_exists('phoneNumber', $changes)) {
                    $user->phone_number = $changes['phoneNumber'];
                }
                if (array_key_exists('messengerLink', $changes)) {
                    $user->messenger_link = $changes['messengerLink'];
                }
                $user->save();
            }

            $editRequest->status = $data['decision'];
            $editRequest->reviewed_by = $admin->id;
            $editRequest->reviewed_at = now();
            $editRequest->save();

            return ['request' => $editRequest->load('user')];
        });

        if (isset($result['conflict'])) {
            return response()->json(['message' => 'This profile edit request has already been reviewed.'], 409);
        }
        if (isset($result['invalid'])) {
            return response()->json([
                'message' => 'The requested changes are no longer valid. Ask the user to submit a new request.',
                'errors' => $result['errors'],
            ], 422);
        }

        return response()->json(['request' => $this->payload($result['request'])]);
    }

    private function payload(ProfileEditRequest $editRequest): array
    {
        $user = $editRequest->user;

        return [
            'id' => (string) $editRequest->id,
            'userId' => (string) $editRequest->user_id,
            'userName' => $user?->name,
            'userEmail' => $user?->email,
            'current' => $user ? [
                'name' => $user->name,
                'email' => $user->email,
                'birthday' => $user->birthday?->format('Y-m-d'),
                'phoneNumber' => $user->phone_number,
                'messengerLink' => $user->messenger_link,
            ] : [],
            'changes' => $editRequest->changes,
            'status' => $editRequest->status,
            'createdAt' => $editRequest->created_at?->toISOString(),
            'reviewedAt' => $editRequest->reviewed_at?->toISOString(),
        ];
    }
}

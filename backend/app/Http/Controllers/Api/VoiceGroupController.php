<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\VoiceGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VoiceGroupController extends Controller
{
    public function index(): JsonResponse
    {
        $groups = VoiceGroup::query()->withCount('users')->orderBy('name')->get();

        return response()->json(['data' => $groups->map(fn (VoiceGroup $group): array => [
            'id' => (string) $group->id,
            'name' => $group->name,
            'description' => $group->description,
            'memberCount' => $group->users_count,
        ])]);
    }

    public function store(Request $request): JsonResponse
    {
        $group = VoiceGroup::query()->create($this->validated($request));

        return response()->json(['voiceGroup' => $this->payload($group)], 201);
    }

    public function update(Request $request, VoiceGroup $voiceGroup): JsonResponse
    {
        $voiceGroup->fill($this->validated($request))->save();

        return response()->json(['voiceGroup' => $this->payload($voiceGroup)]);
    }

    public function destroy(VoiceGroup $voiceGroup): JsonResponse
    {
        $voiceGroup->delete();

        return response()->json(['deleted' => true]);
    }

    public function assignUsers(Request $request, int $userId): JsonResponse
    {
        $user = User::query()->findOrFail($userId);
        $data = $request->validate([
            'voiceGroups' => ['required', 'array'],
            'voiceGroups.*.id' => ['required', 'integer', 'distinct', 'exists:voice_groups,id'],
            'voiceGroups.*.voicePart' => ['nullable', 'string', 'max:80'],
        ]);

        $sync = [];
        foreach ($data['voiceGroups'] as $group) {
            $sync[$group['id']] = ['voice_part' => $group['voicePart'] ?? null];
        }
        $user->voiceGroups()->sync($sync);

        return response()->json(['voiceGroups' => $user->voiceGroups()->orderBy('name')->get()->map(
            fn (VoiceGroup $group): array => [
                'id' => (string) $group->id,
                'name' => $group->name,
                'voicePart' => $group->pivot->voice_part,
            ],
        )]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
        ]);
    }

    private function payload(VoiceGroup $group): array
    {
        return [
            'id' => (string) $group->id,
            'name' => $group->name,
            'description' => $group->description,
        ];
    }
}

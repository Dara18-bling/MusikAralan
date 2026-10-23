<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnnouncementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $groupIds = $user->voiceGroups()->pluck('voice_groups.id');
        $items = DB::table('announcements')
            ->where(fn ($query) => $query->whereNull('target_group_id')->orWhereIn('target_group_id', $groupIds))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($item) => [
                'id' => (string) $item->id,
                'title' => $item->title,
                'content' => $item->content,
                'voiceGroupId' => $item->target_group_id === null ? null : (string) $item->target_group_id,
                'createdAt' => $item->created_at,
            ]);

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $item = $this->validated($request);
        $id = DB::table('announcements')->insertGetId([
            'author_id' => $request->attributes->get('app_user')->id,
            'target_group_id' => $item['targetGroupId'] ?? null,
            'title' => $item['title'],
            'content' => $item['content'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        UserNotificationController::notifyAnnouncement(
            $item['title'],
            $item['content'],
            $id,
            $item['targetGroupId'] ?? null,
        );

        return response()->json(['announcement' => $this->find($id)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $item = $this->validated($request);
        $announcement = DB::table('announcements')->where('id', $id)->first();
        abort_if($announcement === null, 404);
        DB::table('announcements')->where('id', $id)->update([
            'target_group_id' => array_key_exists('targetGroupId', $item)
                ? $item['targetGroupId']
                : $announcement->target_group_id,
            'title' => $item['title'],
            'content' => $item['content'],
            'updated_at' => now(),
        ]);

        return response()->json(['announcement' => $this->find($id)]);
    }

    public function destroy(string $id): JsonResponse
    {
        abort_unless(DB::table('announcements')->where('id', $id)->delete(), 404);

        return response()->json(['deleted' => true]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
            'targetGroupId' => ['nullable', 'integer', 'exists:voice_groups,id'],
        ]);
    }

    private function find(string $id): array
    {
        $item = DB::table('announcements')->where('id', $id)->first();

        return [
            'id' => (string) $item->id,
            'title' => $item->title,
            'content' => $item->content,
            'voiceGroupId' => $item->target_group_id === null ? null : (string) $item->target_group_id,
            'createdAt' => $item->created_at,
        ];
    }
}

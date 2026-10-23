<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classroom;
use App\Models\User;
use App\Notifications\AppMessageNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserNotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->attributes->get('app_user');
        $notifications = $user->notifications()->latest()->limit(50)->get();

        return response()->json([
            'data' => $notifications->map(fn ($notification): array => [
                'id' => $notification->id,
                'kind' => $notification->data['kind'] ?? 'message',
                'title' => $notification->data['title'] ?? 'Notification',
                'content' => $notification->data['content'] ?? '',
                'announcementId' => $notification->data['announcementId'] ?? null,
                'classId' => $notification->data['classId'] ?? null,
                'readAt' => $notification->read_at?->toISOString(),
                'createdAt' => $notification->created_at?->toISOString(),
            ]),
        ]);
    }

    public function markRead(Request $request, string $notificationId): JsonResponse
    {
        $notification = $request->attributes->get('app_user')
            ->notifications()
            ->whereKey($notificationId)
            ->firstOrFail();
        $notification->markAsRead();

        return response()->json(['read' => true]);
    }

    public function notifyClass(Request $request, Classroom $class): JsonResponse
    {
        $sender = $request->attributes->get('app_user');
        abort_unless(
            $sender->role === 'admin' || ($sender->role === 'teacher' && (int) $class->teacher_id === (int) $sender->id),
            403,
        );
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:10000'],
        ]);
        $recipients = $class->students()->where('users.status', 'approved')->get();
        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'This class has no approved students to notify.'], 422);
        }

        foreach ($recipients as $recipient) {
            $recipient->notify(new AppMessageNotification(
                'class',
                trim($data['title']),
                trim($data['content']),
                classId: $class->id,
            ));
        }

        return response()->json(['notified' => $recipients->count()], 201);
    }

    public static function notifyAnnouncement(string $title, string $content, int $announcementId, ?int $voiceGroupId = null): void
    {
        $recipients = User::query()
            ->where('status', 'approved')
            ->when(
                $voiceGroupId !== null,
                fn ($query) => $query->whereHas('voiceGroups', fn ($groups) => $groups->where('voice_groups.id', $voiceGroupId)),
            )
            ->get();

        foreach ($recipients as $recipient) {
            $recipient->notify(new AppMessageNotification(
                'announcement',
                $title,
                $content,
                announcementId: $announcementId,
            ));
        }
    }
}

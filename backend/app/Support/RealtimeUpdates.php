<?php

namespace App\Support;

use App\Events\DataChanged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

final class RealtimeUpdates
{
    /**
     * @param  array<int, string>  $topics
     * @param  array<int, int|string>  $userIds
     * @param  array<int, string>  $roles
     * @param  array<int, int|string>  $classIds
     */
    public static function publish(
        array $topics,
        array $userIds = [],
        array $roles = [],
        array $classIds = [],
    ): void {
        $topics = array_values(array_unique($topics));
        $userIds = array_values(array_unique(array_map('strval', $userIds)));
        $roles = array_values(array_unique($roles));
        $classIds = array_values(array_unique(array_map('intval', $classIds)));

        $publish = static function (?int $classId = null) use ($topics, $userIds, $roles): void {
            $channels = [
                ...array_map(static fn (string $id): string => "users.{$id}", $userIds),
                ...array_map(static fn (string $role): string => "roles.{$role}", $roles),
            ];
            if ($classId !== null) {
                $channels[] = "classes.{$classId}";
            }
            if ($channels === []) {
                return;
            }

            try {
                foreach (array_chunk($channels, 100) as $channelBatch) {
                    event(new DataChanged($topics, $channelBatch, $classId));
                }
            } catch (Throwable $exception) {
                Log::warning('Could not broadcast an application data change.', [
                    'topics' => $topics,
                    'class_id' => $classId,
                    'exception' => $exception::class,
                    'reason' => $exception->getMessage(),
                ]);
            }
        };

        $afterCommit = static function () use ($publish, $classIds): void {
            if ($classIds === []) {
                $publish();

                return;
            }

            foreach ($classIds as $classId) {
                $publish($classId);
            }
        };

        if (DB::transactionLevel() > 0) {
            DB::afterCommit($afterCommit);

            return;
        }

        $afterCommit();
    }
}

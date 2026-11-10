<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class DataChanged implements ShouldBroadcastNow
{
    /**
     * @param  array<int, string>  $topics
     * @param  array<int, string>  $channels
     */
    public function __construct(
        public array $topics,
        public array $channels,
        public ?int $classId = null,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return array_map(
            static fn (string $channel): PrivateChannel => new PrivateChannel($channel),
            $this->channels,
        );
    }

    public function broadcastAs(): string
    {
        return 'data.changed';
    }

    /**
     * @return array{topics: array<int, string>, classId: int|null}
     */
    public function broadcastWith(): array
    {
        return [
            'topics' => $this->topics,
            'classId' => $this->classId,
        ];
    }
}

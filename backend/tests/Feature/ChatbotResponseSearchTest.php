<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ChatbotResponseSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_returns_all_active_matches_ranked_by_relevance(): void
    {
        $user = User::factory()->create(['firebase_uid' => 'help-search-user']);
        $this->actingAs($user);

        foreach ([
            ['keywords' => 'classes', 'response' => 'Exact match', 'deleted' => false],
            ['keywords' => 'class', 'response' => 'Partial match', 'deleted' => false],
            ['keywords' => 'classess', 'response' => 'Typo match', 'deleted' => false],
            ['keywords' => 'classes', 'response' => 'Deleted match', 'deleted' => true],
            ['keywords' => '', 'response' => 'Default answer', 'deleted' => false],
        ] as $index => $item) {
            DB::table('chatbot_responses')->insert([
                'legacy_key' => "search-test-{$index}",
                ...$item,
            ]);
        }

        $this->getJson('/api/chatbot-responses/search?q=classes')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.response', 'Exact match')
            ->assertJsonPath('data.1.response', 'Partial match')
            ->assertJsonPath('data.2.response', 'Typo match');
    }

    public function test_search_returns_no_matches_when_query_contains_only_stop_words(): void
    {
        $user = User::factory()->create(['firebase_uid' => 'help-search-stop-words']);
        $this->actingAs($user);

        $this->getJson('/api/chatbot-responses/search?q=how%20do%20I')
            ->assertOk()
            ->assertExactJson(['data' => []]);
    }
}

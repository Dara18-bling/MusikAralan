<?php

namespace Database\Seeders;

use App\Models\Classroom;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->warn('Demo records are seeded only in local and testing environments.');

            return;
        }

        $admin = $this->seedUser('admin@musik.test', 'Demo Administrator', 'admin');
        $teacher = $this->seedUser('teacher@musik.test', 'Demo Teacher', 'teacher');
        $student = $this->seedUser('student@musik.test', 'Demo Student', 'student');

        $class = Classroom::query()->updateOrCreate(
            ['name' => 'Basic Keyboard Lessons'],
            [
                'teacher_id' => $teacher->id,
                'age_group' => 'all',
                'description' => '8 weeks · 16 lessons',
                'available_for_enrollment' => true,
                'deleted' => false,
            ],
        );
        $class->students()->syncWithoutDetaching([$student->id => ['enrolled_at' => now()]]);

        foreach ([
            ['Solfeggio (Kids)', 'kids', 'Build note reading and pitch skills.'],
            ['Psalmody Masterclass', 'adults', '6 weeks · live coaching'],
            ['Advanced Choir Repertoire', 'all', 'For tenors and sopranos'],
        ] as [$name, $age, $description]) {
            Classroom::query()->updateOrCreate(
                ['name' => $name],
                [
                    'teacher_id' => null,
                    'age_group' => $age,
                    'description' => $description,
                    'available_for_enrollment' => true,
                    'deleted' => false,
                ],
            );
        }

        foreach ([
            ['join-class', 'class meet join', 'Tap "Live Classes" on the left, then the blue "Join on Google Meet" button.'],
            ['download-pdf', 'download pdf', 'Open Materials, choose the lesson, then tap Download.'],
            ['general-help', 'help support assist assistance', 'What can I help with? Ask about joining a class, downloading a lesson, or using your account.'],
            ['fallback', '', 'Salamat po! A coordinator will reply soon.'],
        ] as [$key, $keywords, $response]) {
            DB::table('chatbot_responses')->updateOrInsert(
                ['legacy_key' => $key],
                [
                    'keywords' => $keywords,
                    'response' => $response,
                    'deleted' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }

        DB::table('announcements')->updateOrInsert(
            ['legacy_id' => 'demo-welcome'],
            [
                'author_id' => $admin->id,
                'title' => 'Welcome to MusikAralan',
                'content' => 'This is a sample announcement created by the local/testing seeder.',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );
    }

    private function seedUser(string $email, string $name, string $role): User
    {
        return User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make('Password123!'),
                'email_verified_at' => now(),
                'role' => $role,
                'status' => 'approved',
                'access_until' => $role === 'teacher' ? now()->addYear()->toDateString() : null,
                'date_requested' => now(),
            ],
        );
    }
}

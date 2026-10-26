<?php

namespace Database\Seeders;

use App\Models\Assessment;
use App\Models\AssessmentAttempt;
use App\Models\Classroom;
use App\Models\Material;
use App\Models\Module;
use App\Models\ModuleProgress;
use App\Models\PracticeSession;
use App\Models\ScheduleEvent;
use App\Models\User;
use App\Models\VoiceGroup;
use App\Notifications\AppMessageNotification;
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

        fake()->seed(20261023);

        $admin = $this->seedUser('admin@musik.test', 'Demo Administrator', 'admin');
        $teachers = collect([
            $this->seedUser('teacher@musik.test', 'Demo Teacher', 'teacher', approvedBy: $admin->id),
            $this->seedUser('teacher.maria@musik.test', 'Maria Santos', 'teacher', approvedBy: $admin->id),
            $this->seedUser('teacher.jose@musik.test', 'Jose Reyes', 'teacher', approvedBy: $admin->id),
        ]);
        $students = collect();
        for ($index = 1; $index <= 24; $index++) {
            $students->push($this->seedUser(
                $index === 1 ? 'student@musik.test' : sprintf('student%02d@musik.test', $index),
                $index === 1 ? 'Demo Student' : fake()->name(),
                'student',
                $index > 22 ? 'pending' : 'approved',
                $index > 22 ? null : 1997 + ($index % 15),
                $index > 22 ? null : $admin->id,
            ));
        }

        $voiceGroups = collect([
            'Soprano' => 'High vocal range',
            'Alto' => 'Lower vocal range',
            'Tenor' => 'High male vocal range',
            'Bass' => 'Low male vocal range',
        ])->mapWithKeys(fn (string $description, string $name) => [
            $name => VoiceGroup::query()->updateOrCreate(['name' => $name], ['description' => $description]),
        ]);

        $classes = collect([
            ['Basic Keyboard Lessons', 0, 'all', 'Keyboard fundamentals, note reading, and practice.'],
            ['Solfeggio for Beginners', 1, 'kids', 'Build note reading and pitch skills.'],
            ['Psalmody Masterclass', 1, 'adults', 'Learn to lead responsorial psalms with confidence.'],
            ['Choir Repertoire: Ordinary Time', 2, 'all', 'Repertoire, blend, and ensemble listening.'],
            ['Music Theory Foundations', 0, 'youth', 'Rhythm, scales, intervals, and harmony.'],
            ['Vocal Technique and Breath', 2, 'adults', 'Healthy vocal technique for choir members.'],
            ['Advanced Choir Repertoire', 0, 'all', 'Advanced ensemble work for experienced singers.'],
        ])->map(function (array $record, int $index) use ($teachers): Classroom {
            [$name, $teacherIndex, $ageGroup, $description] = $record;
            $teacher = $teachers[$teacherIndex];

            return Classroom::query()->updateOrCreate(
                ['name' => $name],
                [
                    'teacher_id' => $teacher->id,
                    'age_group' => $ageGroup,
                    'description' => $description,
                    'available_for_enrollment' => $index % 3 !== 2,
                    'deleted' => false,
                    'enrollment_updated_at' => now()->subDays(14 - $index),
                ],
            );
        });

        $students->each(function (User $student, int $index) use ($classes, $voiceGroups): void {
            $classIndexes = array_values(array_unique([$index % $classes->count(), ($index + 2) % $classes->count()]));
            foreach ($classIndexes as $classIndex) {
                $class = $classes[$classIndex];
                if ($student->status !== 'approved') {
                    continue;
                }
                $class->students()->syncWithoutDetaching([
                    $student->id => ['enrolled_at' => now()->subDays(40 - ($index % 30))],
                ]);
            }

            if ($student->status === 'approved') {
                $firstGroup = $voiceGroups->values()[$index % $voiceGroups->count()];
                $secondGroup = $voiceGroups->values()[($index + 1) % $voiceGroups->count()];
                $student->voiceGroups()->syncWithoutDetaching([
                    $firstGroup->id => ['voice_part' => $firstGroup->name.' 1'],
                    $secondGroup->id => ['voice_part' => $secondGroup->name.' 2'],
                ]);
            }
        });

        $modulesByClass = collect();
        $materialsByClass = collect();
        $assessmentsByClass = collect();
        foreach ($classes as $classIndex => $class) {
            $module = $class->modules()->first() ?? Module::query()->create([
                'class_id' => $class->id,
                'title' => $class->name,
                'category' => $class->age_group,
                'description' => $class->description,
                'created_by' => $class->teacher_id,
            ]);
            $module->update([
                'title' => $class->name,
                'category' => $class->age_group,
                'description' => $class->description,
                'created_by' => $class->teacher_id,
                'requires_practice' => $classIndex % 3 === 0,
            ]);
            $modulesByClass->put($class->id, $module);

            $materialRows = [
                ['lesson-notes', 'Reading Notes and Rhythm', 'Review the notation for this module and clap the rhythm before playing.', 'Module', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'],
                ['vocal-guide', 'Vocal Warm-up Guide', 'A short warm-up guide for individual and group practice.', 'Vocal Guide', null],
                ['video-guide', 'Lesson Demonstration', 'Watch the lesson demonstration, then try the exercise at a comfortable tempo.', 'Video Guide', 'https://www.youtube-nocookie.com/embed/ScMzIvxBSi4'],
            ];
            foreach ($materialRows as [$legacyId, $title, $description, $kind, $url]) {
                $material = Material::query()->updateOrCreate(
                    ['class_id' => $class->id, 'legacy_id' => $legacyId],
                    [
                        'module_id' => $module->id,
                        'teacher_id' => $class->teacher_id,
                        'title' => $class->name.': '.$title,
                        'description' => $description,
                        'kind' => $kind,
                        'media_url' => $url,
                        'stream_url' => $url,
                    ],
                );
                $materialsByClass->push($material);
            }

            $assessment = Assessment::query()->updateOrCreate(
                ['class_id' => $class->id, 'assessment_code' => 'A1'],
                ['module_id' => $module->id, 'title' => $class->name.' Knowledge Check', 'passing_percent' => 70],
            );
            $assessmentsByClass->put($class->id, $assessment);
            $questions = [
                ['prompt' => 'Which clef is commonly used for higher-pitched notes?', 'type' => 'multiple', 'options' => ['Treble clef', 'Bass clef', 'Alto clef', 'Tenor clef'], 'correct_option_index' => 0, 'correct_answer' => null],
                ['prompt' => 'A whole note lasts longer than a quarter note.', 'type' => 'truefalse', 'options' => ['True', 'False'], 'correct_option_index' => 0, 'correct_answer' => null],
                ['prompt' => 'How many lines are on a standard musical staff?', 'type' => 'multiple', 'options' => ['Four', 'Five', 'Six', 'Seven'], 'correct_option_index' => 1, 'correct_answer' => null],
                ['prompt' => 'Name the first note of the C major scale.', 'type' => 'identification', 'options' => null, 'correct_option_index' => null, 'correct_answer' => 'C'],
            ];
            foreach ($questions as $position => $question) {
                $assessment->questions()->updateOrCreate(['position' => $position], $question);
            }

            if ($class->teacher_id !== null) {
                ScheduleEvent::query()->updateOrCreate(
                    ['title' => $class->name.' - Group Session', 'class_id' => $class->id],
                    [
                        'created_by' => $class->teacher_id,
                        'description' => 'Review this module together and bring your questions.',
                        'starts_at' => now()->addDays($classIndex + 1)->setTime(18 + ($classIndex % 2), 0),
                        'join_url' => null,
                    ],
                );
            }
        }

        foreach ($classes as $classIndex => $class) {
            $classStudents = $class->students()->where('users.status', 'approved')->orderBy('users.id')->get();
            foreach ($classStudents as $studentIndex => $student) {
                $module = $modulesByClass[$class->id];
                $assessment = $assessmentsByClass[$class->id];
                $progress = ModuleProgress::query()->updateOrCreate(
                    ['user_id' => $student->id, 'module_id' => $module->id],
                    [
                        'status' => 'in_progress',
                        'completed_at' => null,
                    ],
                );

                foreach ($materialsByClass->where('class_id', $class->id)->take($studentIndex % 4) as $material) {
                    DB::table('material_completions')->updateOrInsert(
                        ['student_id' => $student->id, 'material_id' => $material->id],
                        ['completed_at' => now()->subDays(($studentIndex % 10) + 1)],
                    );
                }

                if ($studentIndex % 2 === 0) {
                    PracticeSession::query()->updateOrCreate(
                        ['module_progress_id' => $progress->id, 'practice_type' => 'note-reading'],
                        ['score' => min(100, 60 + (($studentIndex * 7) % 41)), 'completed_at' => now()->subDays(($studentIndex % 8) + 1)],
                    );
                }

                $passed = false;
                if ($studentIndex % 4 !== 3) {
                    $score = [100, 75, 50, 25, 0][($studentIndex + $classIndex) % 5];
                    $passed = $score >= $assessment->passing_percent;
                    $attempt = AssessmentAttempt::query()->updateOrCreate(
                        ['legacy_key' => "demo-attempt-{$class->id}-{$student->id}"],
                        [
                            'assessment_id' => $assessment->id,
                            'student_id' => $student->id,
                            'module_progress_id' => $progress->id,
                            'score' => $score,
                            'passed' => $passed,
                            'status' => $passed ? 'passed' : 'failed',
                            'submitted_at' => now()->subDays(($studentIndex % 12) + 1),
                        ],
                    );
                    foreach ($assessment->questions as $question) {
                        $correct = $question->position < (int) ($score / 25);
                        $answer = $question->type === 'identification'
                            ? ($correct ? $question->correct_answer : 'A')
                            : (string) ($correct ? $question->correct_option_index : (($question->correct_option_index + 1) % count($question->options)));
                        $attempt->answers()->updateOrCreate(
                            ['question_id' => $question->id],
                            ['answer' => $answer, 'correct' => $correct],
                        );
                    }
                }

                $practiceComplete = ! $module->requires_practice
                    || $progress->practiceSessions()->whereNotNull('completed_at')->exists();
                $completed = $passed && $practiceComplete;
                $progress->update([
                    'status' => $completed ? 'completed' : 'in_progress',
                    'completed_at' => $completed ? now()->subDays(($studentIndex % 10) + 1) : null,
                ]);
            }
        }

        $announcements = [
            ['demo-welcome', null, 'Welcome to MusikAralan', 'Explore your classes, review published materials, and check upcoming learning sessions.'],
            ['demo-soprano-news', $voiceGroups['Soprano']->id, 'Soprano section update', 'Please review the vocal guide before our next rehearsal.'],
            ['demo-choir-news', $voiceGroups['Alto']->id, 'Choir practice reminder', 'Bring your music and mark any questions for the section leaders.'],
        ];
        foreach ($announcements as [$legacyId, $groupId, $title, $content]) {
            DB::table('announcements')->updateOrInsert(
                ['legacy_id' => $legacyId],
                [
                    'author_id' => $admin->id,
                    'target_group_id' => $groupId,
                    'title' => $title,
                    'content' => $content,
                    'created_at' => now()->subDays($legacyId === 'demo-welcome' ? 1 : 2),
                    'updated_at' => now(),
                ],
            );
        }

        foreach ([
            ['join-class', 'join class meet session', 'Open Classes to see your enrolled courses, then check Live Sessions for the meeting link.'],
            ['download-pdf', 'download pdf worksheet material', 'Open Classes, choose an enrolled class, and use the resource link on its learning material.'],
            ['quiz-help', 'quiz assessment answer', 'Open the class materials and select the knowledge check. Your score and progress are saved automatically.'],
            ['profile-help', 'profile account password', 'Open My Profile to review the details on your account. Use Forgot Password from the login screen to reset your password.'],
            ['general-help', 'help support assist assistance', 'Ask about classes, materials, assessments, or your account.'],
            ['fallback', '', 'I do not have an answer for that yet. Please contact your coordinator.'],
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

        DB::table('settings')->updateOrInsert(
            ['key' => 'appearance'],
            [
                'value' => json_encode(['primaryColor' => '#6842a6', 'secondaryColor' => '#a855a0', 'paletteName' => 'Advent & Lent · Violet'], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        foreach ([
            ['john', 3, 16],
            ['psalms', 23, 1],
            ['proverbs', 3, 5],
            ['philippians', 4, 13],
            ['romans', 8, 28],
            ['matthew', 5, 16],
        ] as [$book, $chapter, $verse]) {
            DB::table('gospel_verses')->updateOrInsert(
                ['book' => $book, 'chapter' => $chapter, 'verse' => $verse],
                ['created_at' => now(), 'updated_at' => now()],
            );
        }

        $welcomeAnnouncementId = DB::table('announcements')->where('legacy_id', 'demo-welcome')->value('id');
        $this->seedNotification($students[0], '10000000-0000-4000-8000-000000000001', 'announcement', 'Welcome to MusikAralan', 'Explore your classes, review published materials, and check upcoming learning sessions.', $welcomeAnnouncementId);
        $this->seedNotification($students[0], '10000000-0000-4000-8000-000000000002', 'schedule', 'Your next group session', 'Check the Live Sessions page for the class and meeting details.', null);
    }

    private function seedUser(
        string $email,
        string $name,
        string $role,
        string $status = 'approved',
        ?int $birthYear = null,
        ?int $approvedBy = null,
    ): User {
        return User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make('Password123!'),
                'email_verified_at' => now(),
                'birthday' => $birthYear ? "{$birthYear}-06-15" : null,
                'birth_year' => $birthYear,
                'phone_number' => '09'.str_pad((string) (crc32($email) % 1_000_000_000), 9, '0', STR_PAD_LEFT),
                'role' => $role,
                'status' => $status,
                'approved_by' => $approvedBy,
                'approved_at' => $status === 'approved' && $approvedBy !== null ? now() : null,
                'access_until' => $role === 'teacher' ? now()->addYear()->toDateString() : null,
                'date_requested' => now()->subDays(crc32($email) % 60),
            ],
        );
    }

    private function seedNotification(
        User $recipient,
        string $id,
        string $kind,
        string $title,
        string $content,
        ?int $announcementId,
    ): void {
        DB::table('notifications')->updateOrInsert(
            ['id' => $id],
            [
                'type' => AppMessageNotification::class,
                'notifiable_type' => User::class,
                'notifiable_id' => $recipient->id,
                'data' => json_encode([
                    'kind' => $kind,
                    'title' => $title,
                    'content' => $content,
                    'announcementId' => $announcementId,
                ], JSON_THROW_ON_ERROR),
                'read_at' => null,
                'created_at' => now()->subHours(3),
                'updated_at' => now()->subHours(3),
            ],
        );
    }
}

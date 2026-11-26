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

        $scoreChartClass = $classes->first();
        $students->where('status', 'approved')->each(
            fn (User $student) => $scoreChartClass->students()->syncWithoutDetaching([
                $student->id => ['enrolled_at' => now()->subDays(30)],
            ]),
        );

        $modulesByClass = collect();
        $materialsByClass = collect();
        $assessmentsByClass = collect();
        $scoreChartAssessmentsByClass = collect();
        $classPrefixesByClass = collect();
        $scoreChartScores = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 55, 50, 45, 40, 35, 30, 25, 20];
        $keyboardQuizQuestions = [
            3 => [
                ['Which clef is commonly used for higher-pitched notes?', 'Treble clef', 'Bass clef', 'Alto clef', 'Tenor clef'],
                ['How many lines are on a standard musical staff?', 'Five', 'Four', 'Six', 'Seven'],
                ['Which note follows B in the C major scale?', 'C', 'A', 'D', 'E'],
                ['How many quarter-note beats does a half note usually receive?', 'Two', 'One', 'Three', 'Four'],
                ['Which note commonly receives one beat in 4/4 time?', 'Quarter note', 'Whole note', 'Half note', 'Eighth note'],
                ['What does the top number in 4/4 time indicate?', 'Four beats per measure', 'Four measures per beat', 'Four notes per staff', 'Four half notes per measure'],
                ['How many quarter notes equal one whole note?', 'Four', 'Two', 'Three', 'Eight'],
                ['What does a rest sign indicate?', 'Silence for a duration', 'A louder note', 'A repeated section', 'A change of key'],
                ['What does a sharp do to a note?', 'Raises it by a half step', 'Lowers it by a half step', 'Doubles its duration', 'Makes it silent'],
                ['What does a flat do to a note?', 'Lowers it by a half step', 'Raises it by a half step', 'Doubles its duration', 'Repeats the measure'],
                ['What does a natural sign do?', 'Cancels a sharp or flat', 'Raises a note by a whole step', 'Shortens a note', 'Marks the end of a piece'],
                ['Which key signature has no sharps or flats?', 'C major', 'G major', 'F major', 'D major'],
                ['Where are the lowest pitches found on a piano?', 'On the left', 'In the center', 'On the right', 'Above the keys'],
                ['Where are the highest pitches found on a piano?', 'On the right', 'In the center', 'On the left', 'Below the keys'],
                ['What does forte (f) mean?', 'Loud', 'Soft', 'Fast', 'Smooth'],
                ['What does piano (p) mean in a dynamic marking?', 'Soft', 'Loud', 'Short', 'Accented'],
                ['What does legato ask a player to do?', 'Play smoothly connected notes', 'Play very loudly', 'Pause after each note', 'Speed up gradually'],
                ['What does staccato mean?', 'Play notes short and detached', 'Hold notes as long as possible', 'Play quietly', 'Connect every note smoothly'],
                ['What does a barline separate?', 'Measures', 'Staves', 'Clefs', 'Octaves'],
                ['What is a metronome used to help maintain?', 'A steady tempo', 'A key signature', 'A note name', 'A chord shape'],
            ],
            4 => [
                ['Which symbol is placed at the beginning of a staff to identify note names?', 'Clef', 'Barline', 'Rest', 'Tie'],
                ['Which clef is commonly used for lower-pitched notes?', 'Bass clef', 'Treble clef', 'Alto clef', 'Soprano clef'],
                ['How many spaces are on a standard five-line staff?', 'Four', 'Three', 'Five', 'Six'],
                ['Which pair of notes has the same letter name one octave apart?', 'C and the next higher C', 'C and D', 'E and F', 'G and A'],
                ['How many eighth notes usually equal one quarter note?', 'Two', 'One', 'Three', 'Four'],
                ['What does the bottom number in a time signature identify?', 'The note value counted as one beat', 'The number of measures', 'The number of clefs', 'The tempo marking'],
                ['Which time signature commonly has three quarter-note beats per measure?', '3/4', '2/4', '4/4', '6/8'],
                ['What is a tie used to do?', 'Join the duration of two notes of the same pitch', 'Separate two measures', 'Raise a note', 'Mark a quiet section'],
                ['What is a slur commonly used to show?', 'A group of notes played smoothly', 'A note played loudly', 'A repeated measure', 'A change in tempo'],
                ['What does a double barline often mark?', 'The end of a section or piece', 'The start of every beat', 'A sharp note', 'A short rest'],
                ['Which accidental lowers a note by a half step?', 'Flat', 'Sharp', 'Natural', 'Double sharp'],
                ['Which accidental raises a note by a half step?', 'Sharp', 'Flat', 'Natural', 'Double flat'],
                ['What is the first note of a C major scale?', 'C', 'D', 'E', 'G'],
                ['Which set contains only the white keys around one octave?', 'C, D, E, F, G, A, B', 'C, D, F-sharp, G-sharp', 'A, C-sharp, D-sharp, F', 'B-flat, E-flat, F-sharp, A'],
                ['What does crescendo mean?', 'Gradually get louder', 'Gradually get softer', 'Play detached', 'Return to the beginning'],
                ['What does diminuendo mean?', 'Gradually get softer', 'Gradually get louder', 'Play faster', 'Hold the note longer'],
                ['What does accelerando mean?', 'Gradually get faster', 'Gradually get slower', 'Play more softly', 'Repeat the phrase'],
                ['What does ritardando mean?', 'Gradually get slower', 'Gradually get faster', 'Play loudly', 'Play detached'],
                ['What is an interval?', 'The distance between two pitches', 'A type of rest', 'A group of measures', 'The speed of a song'],
                ['What does a chord contain?', 'Multiple pitches sounded together', 'One note played repeatedly', 'A single rest', 'A tempo change'],
            ],
        ];
        $keyboardQuizScores = [
            3 => [80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 35, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            4 => [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0],
        ];
        $keyboardQuizzesByClass = collect();
        foreach ($classes as $classIndex => $class) {
            $classPrefix = collect(preg_split('/[^\p{L}\p{N}]+/u', trim($class->name), -1, PREG_SPLIT_NO_EMPTY))
                ->map(fn (string $word): string => mb_strtoupper(mb_substr($word, 0, 1)))
                ->implode('');
            $classPrefix = $classPrefix !== '' ? $classPrefix : 'C';
            $classPrefixesByClass->put($class->id, $classPrefix);
            $legacyDemoCodes = [
                'A1' => [$class->name.' Knowledge Check', $classPrefix.'1'],
            ];
            if ($classIndex === 0) {
                $legacyDemoCodes += [
                    'A2' => ['Score Distribution Demo', $classPrefix.'2'],
                    'A3' => ['Keyboard Fundamentals', $classPrefix.'3'],
                    'A4' => ['Keyboard Theory and Rhythm', $classPrefix.'4'],
                ];
            }
            foreach ($legacyDemoCodes as $legacyCode => [$demoTitle, $currentCode]) {
                $legacyAssessment = $class->assessments()
                    ->where('assessment_code', $legacyCode)
                    ->where('title', $demoTitle)
                    ->first();
                if ($legacyAssessment !== null && ! $class->assessments()->where('assessment_code', $currentCode)->exists()) {
                    $legacyAssessment->update(['assessment_code' => $currentCode]);
                }
            }
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
                ['class_id' => $class->id, 'assessment_code' => $classPrefix.'1'],
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
            if ($classIndex === 0) {
                $scoreChartAssessment = Assessment::query()->updateOrCreate(
                    ['class_id' => $class->id, 'assessment_code' => $classPrefix.'2'],
                    [
                        'module_id' => $module->id,
                        'title' => 'Score Distribution Demo',
                        'passing_percent' => 70,
                    ],
                );
                foreach ($questions as $position => $question) {
                    $scoreChartAssessment->questions()->updateOrCreate(['position' => $position], $question);
                }
                $scoreChartAssessmentsByClass->put($class->id, $scoreChartAssessment);

                $keyboardQuizzes = collect();
                foreach ($keyboardQuizQuestions as $assessmentNumber => $quizQuestions) {
                    $assessmentCode = $classPrefix.$assessmentNumber;
                    $keyboardQuiz = Assessment::query()->updateOrCreate(
                        ['class_id' => $class->id, 'assessment_code' => $assessmentCode],
                        [
                            'module_id' => $module->id,
                            'title' => $assessmentNumber === 3
                                ? 'Keyboard Fundamentals'
                                : 'Keyboard Theory and Rhythm',
                            'passing_percent' => 70,
                        ],
                    );
                    foreach ($quizQuestions as $position => [$prompt, $correctOption, $distractorOne, $distractorTwo, $distractorThree]) {
                        $keyboardQuiz->questions()->updateOrCreate(
                            ['position' => $position],
                            [
                                'prompt' => $prompt,
                                'type' => 'multiple',
                                'options' => [$correctOption, $distractorOne, $distractorTwo, $distractorThree],
                                'correct_option_index' => 0,
                                'correct_answer' => null,
                            ],
                        );
                    }
                    $keyboardQuizzes->put($assessmentCode, $keyboardQuiz);
                }
                $keyboardQuizzesByClass->put($class->id, $keyboardQuizzes);
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
            $classPrefix = $classPrefixesByClass[$class->id];
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

                if ($classIndex === 0 && $studentIndex < count($scoreChartScores)) {
                    $score = $scoreChartScores[$studentIndex];
                    $scoreChartAssessment = $scoreChartAssessmentsByClass[$class->id];
                    AssessmentAttempt::query()->updateOrCreate(
                        ['legacy_key' => "demo-score-chart-attempt-{$student->id}"],
                        [
                            'assessment_id' => $scoreChartAssessment->id,
                            'student_id' => $student->id,
                            'module_progress_id' => $progress->id,
                            'score' => $score,
                            'passed' => $score >= $scoreChartAssessment->passing_percent,
                            'status' => $score >= $scoreChartAssessment->passing_percent ? 'passed' : 'failed',
                            'submitted_at' => now()->subDays(($studentIndex % 12) + 1),
                        ],
                    );
                }

                if ($classIndex === 0) {
                    foreach ($keyboardQuizScores as $assessmentNumber => $quizScores) {
                        $score = $quizScores[$studentIndex];
                        $assessmentCode = $classPrefix.$assessmentNumber;
                        $keyboardQuiz = $keyboardQuizzesByClass[$class->id][$assessmentCode];
                        $attempt = AssessmentAttempt::query()->updateOrCreate(
                            ['legacy_key' => "demo-A{$assessmentNumber}-attempt-{$student->id}"],
                            [
                                'assessment_id' => $keyboardQuiz->id,
                                'student_id' => $student->id,
                                'module_progress_id' => $progress->id,
                                'score' => $score,
                                'passed' => $score >= $keyboardQuiz->passing_percent,
                                'status' => $score >= $keyboardQuiz->passing_percent ? 'passed' : 'failed',
                                'submitted_at' => now()->subDays(($studentIndex % 12) + 1),
                            ],
                        );
                        foreach ($keyboardQuiz->questions as $question) {
                            $correct = $question->position < (int) ($score / 5);
                            $answer = (string) ($correct
                                ? $question->correct_option_index
                                : (($question->correct_option_index + 1) % count($question->options)));
                            $attempt->answers()->updateOrCreate(
                                ['question_id' => $question->id],
                                ['answer' => $answer, 'correct' => $correct],
                            );
                        }
                    }
                }
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

        $appearancePalettes = config('appearance.palettes', []);
        DB::table('settings')->updateOrInsert(
            ['key' => 'appearance'],
            [
                'value' => json_encode([
                    'primaryColor' => $appearancePalettes[0]['primary'],
                    'secondaryColor' => $appearancePalettes[0]['secondary'],
                    'paletteName' => $appearancePalettes[0]['name'],
                ], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        foreach ([
            ['JHN', 3, 16],
            ['PSA', 23, 1],
            ['PRO', 3, 5],
            ['PHP', 4, 13],
            ['ROM', 8, 28],
            ['MAT', 5, 16],
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

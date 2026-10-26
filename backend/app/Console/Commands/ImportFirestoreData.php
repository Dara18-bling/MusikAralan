<?php

namespace App\Console\Commands;

use App\Models\Assessment;
use App\Models\AssessmentAttempt;
use App\Models\Classroom;
use App\Models\Material;
use App\Models\User;
use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ImportFirestoreData extends Command
{
    protected $signature = 'musik:import-firestore {--commit : Commit imported data; without this option the import is rolled back}';

    protected $description = 'Backfill MusikAralan MySQL from the existing Firestore collections.';

    private string $documentsUrl;

    private string $accessToken;

    private array $counts = [
        'users' => 0,
        'classes' => 0,
        'materials' => 0,
        'assessments' => 0,
        'announcements' => 0,
        'chatbot responses' => 0,
    ];

    private array $createdFiles = [];

    private array $sourceUsers = [];

    private array $sourceClasses = [];

    private array $sourceMaterialsByClass = [];

    private array $sourceAssessmentsByClass = [];

    private array $sourceAnnouncements = [];

    private array $sourceChatbotResponses = [];

    private ?array $sourceAppearance = null;

    public function handle(): int
    {
        $credentialsPath = config('services.firebase.credentials');
        if (! is_string($credentialsPath) || ! is_file($credentialsPath)) {
            $this->error('Set FIREBASE_CREDENTIALS to a readable Firebase service-account JSON file.');

            return self::FAILURE;
        }

        try {
            $serviceAccount = json_decode(file_get_contents($credentialsPath), true, flags: JSON_THROW_ON_ERROR);
            $projectId = $serviceAccount['project_id'] ?? null;
            if (! is_string($projectId) || $projectId === '') {
                $this->error('The Firebase service-account file does not contain project_id.');

                return self::FAILURE;
            }
            $credentials = new ServiceAccountCredentials(
                'https://www.googleapis.com/auth/datastore',
                $serviceAccount,
            );
            $token = $credentials->fetchAuthToken()['access_token'] ?? null;
            if (! is_string($token) || $token === '') {
                $this->error('Could not obtain a Google access token from the Firebase service account.');

                return self::FAILURE;
            }
            $this->accessToken = $token;
            $this->documentsUrl = 'https://firestore.googleapis.com/v1/projects/'.$projectId.'/databases/(default)/documents';

            $this->sourceUsers = $this->documents('users');
            $this->sourceClasses = $this->documents('classes');
            foreach ($this->sourceClasses as $classDocument) {
                $classId = $classDocument['id'];
                $this->sourceMaterialsByClass[$classId] = $this->documents('classes/'.$classId.'/materials');
                $this->sourceAssessmentsByClass[$classId] = $this->document('classes/'.$classId.'/assessments/published');
            }
            $this->sourceAnnouncements = $this->documents('announcements');
            $this->sourceChatbotResponses = $this->documents('chatbotResponses');
            $this->sourceAppearance = $this->document('settings/appearance');

            DB::beginTransaction();
            $this->importUsers();
            $this->importClasses();
            $this->importAnnouncements();
            $this->importChatbotResponses();
            $this->importAppearance();
            $this->importEnrollmentAndProgress();

            if ($this->option('commit')) {
                DB::commit();
                $this->info('Firestore records imported and committed.');
            } else {
                DB::rollBack();
                $this->removeCreatedFiles();
                $this->warn('Dry run complete. No database changes were committed. Re-run with --commit to import.');
            }
            foreach ($this->counts as $resource => $count) {
                $this->line("{$resource}: {$count}");
            }

            return self::SUCCESS;
        } catch (Throwable $exception) {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            $this->removeCreatedFiles();
            report($exception);
            $this->error('Firestore import failed: '.$exception->getMessage());

            return self::FAILURE;
        }
    }

    private function importUsers(): void
    {
        foreach ($this->sourceUsers as $document) {
            $data = $document['data'];
            $email = $data['email'] ?? null;
            if (! is_string($email) || $email === '') {
                $this->warn("Skipping user {$document['id']}: email is missing.");
                continue;
            }
            $email = strtolower($email);
            $birthday = $this->date($data['birthday'] ?? null);
            $status = in_array($data['status'] ?? null, ['pending', 'approved', 'rejected', 'inactive'], true)
                ? $data['status']
                : 'approved';
            $role = in_array($data['role'] ?? null, ['student', 'teacher', 'admin'], true)
                ? $data['role']
                : 'student';
            User::query()->updateOrCreate(
                ['firebase_uid' => $document['id']],
                [
                    'name' => (string) ($data['name'] ?? ''),
                    'email' => $email,
                    'birthday' => $birthday,
                    'birth_year' => isset($data['birthYear']) ? (int) $data['birthYear'] : ($birthday ? (int) substr($birthday, 0, 4) : null),
                    'phone_number' => $data['phoneNumber'] ?? null,
                    'phone_verified' => (bool) ($data['phoneVerified'] ?? false),
                    'messenger_link' => $data['messengerLink'] ?? null,
                    'role' => $role,
                    'status' => $status,
                    'access_until' => $this->date($data['accessUntil'] ?? null),
                    'date_requested' => $this->dateTime($data['dateRequested'] ?? null),
                ],
            );
            $this->counts['users']++;
        }
    }

    private function importClasses(): void
    {
        foreach ($this->sourceClasses as $document) {
            $data = $document['data'];
            $name = (string) ($data['name'] ?? 'Unnamed class');
            $teacherName = trim((string) ($data['teacher'] ?? ''));
            $teacherId = $teacherName === '' || strtolower($teacherName) === 'unassigned'
                ? null
                : User::query()->where('role', 'teacher')->where('status', 'approved')->where('name', $teacherName)->value('id');
            $class = Classroom::query()->where('legacy_id', $document['id'])->first()
                ?? Classroom::query()->where('name', $name)->first()
                ?? new Classroom();
            $class->legacy_id = $document['id'];
            $class->name = $name;
            $class->teacher_id = $teacherId;
            $class->age_group = in_array($data['age'] ?? null, ['all', 'kids', 'youth', 'adults'], true) ? $data['age'] : 'all';
            $class->description = (string) ($data['description'] ?? '');
            $class->available_for_enrollment = (bool) ($data['availableForEnrollment'] ?? false);
            $class->deleted = (bool) ($data['deleted'] ?? false);
            $class->enrollment_updated_at = $this->dateTime($data['enrollmentUpdatedAt'] ?? null);
            $class->save();

            foreach ($this->sourceMaterialsByClass[$document['id']] ?? [] as $materialDocument) {
                $this->importMaterial($class, $materialDocument, $teacherId);
            }
            $assessmentDocument = $this->sourceAssessmentsByClass[$document['id']] ?? null;
            if ($assessmentDocument) {
                $this->importAssessment($class, $assessmentDocument['data']);
            }
            $this->counts['classes']++;
        }
    }

    private function importMaterial(Classroom $class, array $document, ?int $teacherId): void
    {
        $data = $document['data'];
        $mediaUrl = $this->safeExternalUrl($data['mediaUrl'] ?? null);
        $streamUrl = $this->safeExternalUrl($data['streamUrl'] ?? null);
        $storagePath = null;
        foreach (['mediaUrl' => &$mediaUrl, 'streamUrl' => &$streamUrl] as &$url) {
            if (is_string($url) && str_starts_with($url, 'data:')) {
                if ($storagePath === null) {
                    $storagePath = $this->storeDataUrl($url);
                }
                $url = Storage::disk('public')->url($storagePath);
            }
        }
        unset($url);
        Material::query()->updateOrCreate(
            ['class_id' => $class->id, 'legacy_id' => $document['id']],
            [
                'teacher_id' => $teacherId,
                'title' => (string) ($data['title'] ?? 'Untitled material'),
                'description' => (string) ($data['description'] ?? ''),
                'kind' => (string) ($data['kind'] ?? 'Others'),
                'media_url' => $mediaUrl,
                'stream_url' => $streamUrl,
                'storage_path' => $storagePath,
                'created_at' => $this->dateTime($data['createdAt'] ?? null) ?? now(),
                'updated_at' => now(),
            ],
        );
        $this->counts['materials']++;
    }

    private function importAssessment(Classroom $class, array $data): void
    {
        $assessment = Assessment::query()->updateOrCreate(
            ['class_id' => $class->id, 'assessment_code' => 'A1'],
            [
                'title' => (string) ($data['title'] ?? 'Class assessment'),
                'passing_percent' => max(0, min(100, (int) ($data['passingPercent'] ?? 70))),
            ],
        );
        $assessment->questions()->delete();
        foreach (array_values(is_array($data['questions'] ?? null) ? $data['questions'] : []) as $position => $question) {
            if (! is_array($question) || empty($question['q'])) {
                continue;
            }
            $type = in_array($question['type'] ?? null, ['multiple', 'truefalse', 'identification'], true)
                ? $question['type']
                : 'multiple';
            $assessment->questions()->create([
                'position' => $position,
                'prompt' => (string) $question['q'],
                'type' => $type,
                'options' => is_array($question['o'] ?? null) ? $question['o'] : [],
                'correct_option_index' => $type === 'identification' ? null : (int) ($question['a'] ?? 0),
                'correct_answer' => $type === 'identification' ? (string) ($question['answer'] ?? '') : null,
            ]);
        }
        $this->counts['assessments']++;
    }

    private function importAnnouncements(): void
    {
        foreach ($this->sourceAnnouncements as $document) {
            $data = $document['data'];
            DB::table('announcements')->updateOrInsert(
                ['legacy_id' => $document['id']],
                [
                    'title' => (string) ($data['title'] ?? 'Announcement'),
                    'content' => (string) ($data['content'] ?? ''),
                    'created_at' => $this->dateTime($data['createdAt'] ?? null) ?? now(),
                    'updated_at' => now(),
                ],
            );
            $this->counts['announcements']++;
        }
    }

    private function importChatbotResponses(): void
    {
        foreach ($this->sourceChatbotResponses as $document) {
            $data = $document['data'];
            DB::table('chatbot_responses')->updateOrInsert(
                ['legacy_key' => $document['id']],
                [
                    'keywords' => (string) ($data['keywords'] ?? ''),
                    'response' => (string) ($data['response'] ?? ''),
                    'deleted' => (bool) ($data['deleted'] ?? false),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
            $this->counts['chatbot responses']++;
        }
    }

    private function importAppearance(): void
    {
        $document = $this->sourceAppearance;
        if (! $document) {
            return;
        }
        DB::table('settings')->updateOrInsert(
            ['key' => 'appearance'],
            [
                'value' => json_encode($document['data'], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );
    }

    private function importEnrollmentAndProgress(): void
    {
        foreach ($this->sourceUsers as $userDocument) {
            $student = User::query()->where('firebase_uid', $userDocument['id'])->first();
            if (! $student) {
                continue;
            }
            $userData = $userDocument['data'];
            foreach (($userData['enrolledClassIds'] ?? []) as $legacyClassId) {
                $class = Classroom::query()->where('legacy_id', (string) $legacyClassId)->first();
                if ($class) {
                    $class->students()->syncWithoutDetaching([$student->id => ['enrolled_at' => now()]]);
                }
            }
            foreach (($userData['classProgress'] ?? []) as $legacyClassId => $progress) {
                $class = Classroom::query()->where('legacy_id', (string) $legacyClassId)->first();
                if (! $class || ! is_array($progress)) {
                    continue;
                }
                foreach (($progress['completedMaterialIds'] ?? []) as $legacyMaterialId) {
                    $material = Material::query()->where('class_id', $class->id)->where('legacy_id', (string) $legacyMaterialId)->first();
                    if ($material) {
                        DB::table('material_completions')->updateOrInsert(
                            ['student_id' => $student->id, 'material_id' => $material->id],
                            ['completed_at' => now()],
                        );
                    }
                }
                if (isset($progress['assessmentScore']) && $class->assessments()->exists()) {
                    $assessment = $class->assessments()->orderBy('id')->first();
                    AssessmentAttempt::query()->updateOrCreate(
                        ['legacy_key' => $student->firebase_uid.':'.$legacyClassId],
                        [
                            'assessment_id' => $assessment->id,
                            'student_id' => $student->id,
                            'score' => max(0, min(100, (int) $progress['assessmentScore'])),
                            'passed' => (bool) ($progress['assessmentPassed'] ?? false),
                            'submitted_at' => now(),
                        ],
                    );
                }
            }
        }

        foreach ($this->sourceClasses as $classDocument) {
            $class = Classroom::query()->where('legacy_id', $classDocument['id'])->first();
            if (! $class) {
                continue;
            }
            foreach (($classDocument['data']['enrolledStudentIds'] ?? []) as $uid) {
                $student = User::query()->where('firebase_uid', (string) $uid)->first();
                if ($student) {
                    $class->students()->syncWithoutDetaching([$student->id => ['enrolled_at' => now()]]);
                }
            }
        }
    }

    private function documents(string $collectionPath): array
    {
        $documents = [];
        $pageToken = null;
        do {
            $query = ['pageSize' => 100];
            if ($pageToken) {
                $query['pageToken'] = $pageToken;
            }
            $response = Http::withToken($this->accessToken)
                ->timeout(60)
                ->get($this->documentsUrl.'/'.$this->encodePath($collectionPath), $query)
                ->throw()
                ->json();
            foreach ($response['documents'] ?? [] as $document) {
                $documents[] = [
                    'id' => basename($document['name']),
                    'data' => $this->decodeFields($document['fields'] ?? []),
                ];
            }
            $pageToken = $response['nextPageToken'] ?? null;
        } while ($pageToken);

        return $documents;
    }

    private function document(string $documentPath): ?array
    {
        $response = Http::withToken($this->accessToken)
            ->timeout(60)
            ->get($this->documentsUrl.'/'.$this->encodePath($documentPath));
        if ($response->status() === 404) {
            return null;
        }
        $response->throw();
        $document = $response->json();

        return [
            'id' => basename($document['name']),
            'data' => $this->decodeFields($document['fields'] ?? []),
        ];
    }

    private function decodeFields(array $fields): array
    {
        $result = [];
        foreach ($fields as $key => $value) {
            $result[$key] = $this->decodeValue($value);
        }

        return $result;
    }

    private function decodeValue(array $value): mixed
    {
        if (isset($value['stringValue'])) return $value['stringValue'];
        if (isset($value['integerValue'])) return (int) $value['integerValue'];
        if (isset($value['doubleValue'])) return (float) $value['doubleValue'];
        if (isset($value['booleanValue'])) return (bool) $value['booleanValue'];
        if (isset($value['timestampValue'])) return $value['timestampValue'];
        if (isset($value['nullValue'])) return null;
        if (isset($value['arrayValue']['values'])) return array_map(fn (array $item) => $this->decodeValue($item), $value['arrayValue']['values']);
        if (isset($value['mapValue']['fields'])) return $this->decodeFields($value['mapValue']['fields']);

        return null;
    }

    private function encodePath(string $path): string
    {
        return implode('/', array_map('rawurlencode', explode('/', $path)));
    }

    private function date(mixed $value): ?string
    {
        $date = $this->dateTime($value);

        return $date?->toDateString();
    }

    private function dateTime(mixed $value): ?\Illuminate\Support\Carbon
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return \Illuminate\Support\Carbon::parse($value);
        } catch (Throwable) {
            return null;
        }
    }

    private function storeDataUrl(string $dataUrl): string
    {
        if (! preg_match('/^data:(?<mime>image\\/(?:png|jpe?g|gif|webp)|application\\/(?:pdf|vnd\\.[a-zA-Z0-9.+-]+)|audio\\/[a-zA-Z0-9.+-]+|video\\/[a-zA-Z0-9.+-]+|text\\/(?:csv|plain));base64,(?<data>[A-Za-z0-9+\\/=]+)$/', $dataUrl, $matches)) {
            throw new \RuntimeException('A Firestore material contains an unsupported data URL.');
        }
        $contents = base64_decode($matches['data'], true);
        if ($contents === false || strlen($contents) > 1024 * 1024) {
            throw new \RuntimeException('A Firestore material file is invalid or larger than 1 MB.');
        }
        $extension = match ($matches['mime']) {
            'application/pdf' => 'pdf',
            'text/csv' => 'csv',
            'text/plain' => 'txt',
            default => explode('/', $matches[1])[1],
        };
        $path = 'materials/imported/'.bin2hex(random_bytes(16)).'.'.$extension;
        if (! Storage::disk('public')->put($path, $contents)) {
            throw new \RuntimeException('Could not store an imported Firestore material file.');
        }
        $this->createdFiles[] = $path;

        return $path;
    }

    private function safeExternalUrl(mixed $url): ?string
    {
        if (! is_string($url) || $url === '') {
            return null;
        }
        if (str_starts_with($url, 'data:')) {
            return $url;
        }
        $parts = parse_url($url);

        return is_array($parts)
            && strtolower($parts['scheme'] ?? '') === 'https'
            && isset($parts['host'])
            && ! isset($parts['user'], $parts['pass'])
            ? $url
            : null;
    }

    private function removeCreatedFiles(): void
    {
        foreach ($this->createdFiles as $path) {
            if (! Storage::disk('public')->delete($path)) {
                $this->warn("Could not remove temporary imported file {$path}.");
            }
        }
        $this->createdFiles = [];
    }
}

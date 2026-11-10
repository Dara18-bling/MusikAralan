<?php

namespace App\Jobs;

use App\Models\Material;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Symfony\Component\Process\Process;
use Throwable;

class ProcessSheetMusic implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 360;

    public int $uniqueFor = 3600;

    public function __construct(
        public int $materialId
    ) {
    }

    public function uniqueId(): string
    {
        return 'sheet-music-' . $this->materialId;
    }

    public function handle(): void
    {
        $material = Material::find($this->materialId);

        if (!$material) {
            return;
        }

        // Skip conversion if a valid MusicXML file already exists.
        if (
            $material->notation_status === 'completed' &&
            $material->musicxml_path &&
            Storage::disk('public')->exists(
                $material->musicxml_path
            )
        ) {
            return;
        }

        $workDirectory = storage_path(
            'app/audiveris/' . uniqid('job_', true)
        );

        try {
            $material->update([
                'notation_status' => 'processing',
                'notation_error' => null,
            ]);

            $sourceDisk = config(
                'filesystems.material_uploads_disk',
                'public'
            );

            $sourcePath = $material->storage_path;

            if (!$sourcePath) {
                throw new RuntimeException(
                    'The material has no stored source file.'
                );
            }

            $disk = Storage::disk($sourceDisk);

            if (!$disk->exists($sourcePath)) {
                throw new RuntimeException(
                    'The original sheet music file could not be found.'
                );
            }

            $extension = strtolower(
                pathinfo($sourcePath, PATHINFO_EXTENSION)
            );

            if (!in_array(
                $extension,
                ['pdf', 'png', 'jpg', 'jpeg'],
                true
            )) {
                throw new RuntimeException(
                    'Unsupported sheet music format.'
                );
            }

            $inputPath = $disk->path($sourcePath);

            File::ensureDirectoryExists($workDirectory);

            $outputDirectory = $workDirectory . '/output';

            File::ensureDirectoryExists($outputDirectory);

            $executable = config('audiveris.executable');

            if (!$executable || !is_file($executable)) {
                throw new RuntimeException(
                    'Audiveris executable was not found.'
                );
            }

            $process = new Process([
                $executable,
                '-batch',
                '-export',
                '-output',
                $outputDirectory,
                '--',
                $inputPath,
            ]);

            $process->setTimeout(
                (int) config('audiveris.timeout', 300)
            );

            $process->run();

            $musicXmlFiles = glob(
                $outputDirectory . '/*.mxl'
            );

            if (!$process->isSuccessful() || empty($musicXmlFiles)) {
                $error = trim($process->getErrorOutput());

                throw new RuntimeException(
                    'Audiveris conversion failed. ' .
                    ($error ?: $process->getOutput())
                );
            }

            $musicXmlPath = 'materials/notation/' .
                $material->id . '_' . uniqid() . '.mxl';

            $saved = Storage::disk('public')->put(
                $musicXmlPath,
                file_get_contents($musicXmlFiles[0])
            );

            if (!$saved) {
                throw new RuntimeException(
                    'The generated MusicXML file could not be saved.'
                );
            }

            $material->update([
                'notation_status' => 'completed',
                'musicxml_path' => $musicXmlPath,
                'notation_error' => null,
                'notation_processed_at' => now(),
            ]);

        } catch (Throwable $exception) {
            $material->update([
                'notation_status' => 'failed',
                'notation_error' => mb_substr(
                    $exception->getMessage(),
                    0,
                    5000
                ),
                'notation_processed_at' => now(),
            ]);

            throw $exception;

        } finally {
            File::deleteDirectory($workDirectory);
        }
    }
}

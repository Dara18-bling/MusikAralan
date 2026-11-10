<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$input = 'C:/AudiverisTest/Input/sample.pdf';
$output = 'C:/AudiverisTest/LaravelOutput';

Illuminate\Support\Facades\File::ensureDirectoryExists($output);

$process = new Symfony\Component\Process\Process([
    'C:/Program Files/Audiveris/Audiveris.exe',
    '-batch',
    '-export',
    '-output',
    $output,
    '--',
    $input,
]);

$process->setTimeout(300);
$process->run();

echo "Exit code: " . $process->getExitCode() . PHP_EOL;
echo "Output:" . PHP_EOL . $process->getOutput() . PHP_EOL;
echo "Errors:" . PHP_EOL . $process->getErrorOutput() . PHP_EOL;
echo "MusicXML files:" . PHP_EOL;

print_r(glob($output . '/*.mxl'));

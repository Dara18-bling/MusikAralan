<?php

namespace Tests\Unit;

use App\Filesystem\S3CompatibleAdapter;
use Aws\Result;
use Aws\S3\S3ClientInterface;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\Config;
use Mockery;
use Tests\TestCase;

class S3CompatibleAdapterTest extends TestCase
{
    public function test_object_uploads_do_not_send_acl_headers(): void
    {
        $client = Mockery::mock(S3ClientInterface::class);
        $client->shouldReceive('putObject')
            ->once()
            ->with(Mockery::on(function (array $parameters): bool {
                $this->assertSame('course-materials', $parameters['Bucket']);
                $this->assertSame('uploads/lesson.pdf', $parameters['Key']);
                $this->assertSame('application/pdf', $parameters['ContentType']);
                $this->assertArrayNotHasKey('ACL', $parameters);

                return true;
            }))
            ->andReturn(new Result);

        $adapter = new S3CompatibleAdapter($client, 'course-materials', 'uploads');
        $adapter->write('lesson.pdf', '%PDF-1.4', new Config);
    }

    public function test_configured_s3_compatible_disk_generates_public_urls(): void
    {
        $this->configureS3CompatibleDisk();

        $this->assertSame(
            'https://materials.example.test/materials/lesson.pdf',
            Storage::disk('s3-compatible')->url('materials/lesson.pdf'),
        );
    }

    public function test_configured_s3_compatible_disk_signs_urls_against_api_endpoint(): void
    {
        $this->configureS3CompatibleDisk();

        $url = Storage::disk('s3-compatible')->temporaryUrl(
            'materials/lesson.pdf',
            now()->addMinutes(30),
        );
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        $this->assertSame('s3.example.test', parse_url($url, PHP_URL_HOST));
        $this->assertStringContainsString('/course-materials/materials/lesson.pdf', (string) parse_url($url, PHP_URL_PATH));
        $this->assertArrayHasKey('X-Amz-Signature', $query);
        $this->assertGreaterThanOrEqual(1740, (int) $query['X-Amz-Expires']);
        $this->assertLessThanOrEqual(1800, (int) $query['X-Amz-Expires']);
    }

    private function configureS3CompatibleDisk(): void
    {
        config()->set('filesystems.disks.s3-compatible', [
            'driver' => 's3-compatible',
            'key' => 'test-key',
            'secret' => 'test-secret',
            'region' => 'auto',
            'bucket' => 'course-materials',
            'url' => 'https://materials.example.test',
            'endpoint' => 'https://s3.example.test',
            'use_path_style_endpoint' => true,
            'visibility' => 'public',
            'throw' => false,
        ]);
        Storage::forgetDisk('s3-compatible');
    }
}

<?php

namespace App\Filesystem;

use Aws\S3\S3ClientInterface;
use League\Flysystem\AwsS3V3\AwsS3V3Adapter;
use League\Flysystem\AwsS3V3\VisibilityConverter;
use League\Flysystem\Config;
use League\Flysystem\PathPrefixer;
use League\Flysystem\UnableToWriteFile;
use League\MimeTypeDetection\FinfoMimeTypeDetector;
use League\MimeTypeDetection\MimeTypeDetector;
use Throwable;

class S3CompatibleAdapter extends AwsS3V3Adapter
{
    private PathPrefixer $keyPrefixer;

    private MimeTypeDetector $mimeTypeDetector;

    public function __construct(
        private S3ClientInterface $s3Client,
        private string $bucket,
        string $prefix = '',
        ?VisibilityConverter $visibility = null,
        ?MimeTypeDetector $mimeTypeDetector = null,
        private array $options = [],
        bool $streamReads = true,
    ) {
        parent::__construct($s3Client, $bucket, $prefix, $visibility, $mimeTypeDetector, $options, $streamReads);
        $this->keyPrefixer = new PathPrefixer($prefix);
        $this->mimeTypeDetector = $mimeTypeDetector ?? new FinfoMimeTypeDetector;
    }

    public function write(string $path, string $contents, Config $config): void
    {
        $this->putObject($path, $contents, $config);
    }

    public function writeStream(string $path, $contents, Config $config): void
    {
        $this->putObject($path, $contents, $config);
    }

    public function createDirectory(string $path, Config $config): void
    {
        // S3-compatible stores represent directories through object key prefixes.
    }

    private function putObject(string $path, $contents, Config $config): void
    {
        $effectiveConfig = $config->withDefaults($this->options);
        $parameters = [
            'Bucket' => $this->bucket,
            'Key' => $this->keyPrefixer->prefixPath($path),
            'Body' => $contents,
        ];
        $contentType = $effectiveConfig->get('ContentType')
            ?? $effectiveConfig->get('mimetype')
            ?? $this->mimeTypeDetector->detectMimeType($path, $contents);
        if ($contentType !== null) {
            $parameters['ContentType'] = $contentType;
        }

        foreach (['CacheControl', 'ContentDisposition', 'ContentEncoding', 'ContentLanguage', 'Expires', 'Metadata', 'StorageClass'] as $option) {
            $value = $effectiveConfig->get($option);
            if ($value !== null) {
                $parameters[$option] = $value;
            }
        }

        // Bucket policies control public access; object ACL headers are not portable across providers.
        try {
            $this->s3Client->putObject($parameters);
        } catch (Throwable $exception) {
            throw UnableToWriteFile::atLocation($path, $exception->getMessage(), $exception);
        }
    }
}

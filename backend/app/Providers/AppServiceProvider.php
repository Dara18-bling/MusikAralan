<?php

namespace App\Providers;

use App\Filesystem\S3CompatibleAdapter;
use Aws\S3\S3Client;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Filesystem\AwsS3V3Adapter as LaravelS3Adapter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use League\Flysystem\AwsS3V3\PortableVisibilityConverter;
use League\Flysystem\Filesystem;
use League\Flysystem\Visibility;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Storage::extend('s3-compatible', function ($app, array $config): LaravelS3Adapter {
            $clientConfig = [
                'version' => 'latest',
                'region' => $config['region'] ?: 'us-east-1',
                'use_path_style_endpoint' => $config['use_path_style_endpoint'] ?? false,
            ];
            if (! empty($config['endpoint'])) {
                $clientConfig['endpoint'] = $config['endpoint'];
            }
            if (! empty($config['key']) && ! empty($config['secret'])) {
                $clientConfig['credentials'] = [
                    'key' => $config['key'],
                    'secret' => $config['secret'],
                ];
                if (! empty($config['token'])) {
                    $clientConfig['credentials']['token'] = $config['token'];
                }
            }

            $client = new S3Client($clientConfig);
            $adapter = new S3CompatibleAdapter(
                $client,
                $config['bucket'],
                $config['root'] ?? '',
                new PortableVisibilityConverter($config['visibility'] ?? Visibility::PUBLIC),
                null,
                $config['options'] ?? [],
                $config['stream_reads'] ?? false,
            );
            $filesystem = new Filesystem($adapter, $config);

            return new LaravelS3Adapter($filesystem, $adapter, $config, $client);
        });

        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(
            strtolower((string) $request->input('email')).'|'.$request->ip(),
        ));
        RateLimiter::for('register', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));
        RateLimiter::for('password-reset-request', fn (Request $request) => [
            Limit::perMinute(3)->by('email:'.strtolower(trim((string) ($request->user()?->email ?? $request->input('email'))))),
            Limit::perMinute(10)->by('ip:'.$request->ip()),
        ]);
        RateLimiter::for('password-reset-confirm', fn (Request $request) => [
            Limit::perMinute(5)->by('email:'.strtolower(trim((string) $request->input('email')))),
            Limit::perMinute(20)->by('ip:'.$request->ip()),
        ]);
    }
}

<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

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
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(
            strtolower((string) $request->input('email')).'|'.$request->ip(),
        ));
        RateLimiter::for('register', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));
        RateLimiter::for('password-reset', fn (Request $request) => Limit::perMinute(3)->by(
            strtolower((string) $request->input('email')).'|'.$request->ip(),
        ));

        ResetPassword::createUrlUsing(fn ($user, string $token): string => rtrim(
            (string) config('app.frontend_url'),
            '/',
        ).'/reset-password?token='.urlencode($token).'&email='.urlencode($user->getEmailForPasswordReset()));
    }
}

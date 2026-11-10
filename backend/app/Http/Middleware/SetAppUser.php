<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetAppUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->attributes->set('app_user', $request->user());

        return $next($request);
    }
}

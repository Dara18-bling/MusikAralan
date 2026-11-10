<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireApprovedAccount
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->attributes->get('app_user');

        if (! $user) {
            return response()->json(['message' => 'Authentication is required.'], 401);
        }

        if ($user->status !== 'approved') {
            return response()->json([
                'message' => $user->status === 'pending'
                    ? 'Your account is still pending admin approval.'
                    : 'This account is not approved for access.',
                'status' => $user->status,
            ], 403);
        }

        return $next($request);
    }
}

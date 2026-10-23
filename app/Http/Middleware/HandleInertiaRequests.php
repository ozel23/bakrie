<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function share(Request $request): array
    {
        $request->session()->forget('epita.demo_account');

        return [...parent::share($request), 'flash' => ['success' => fn () => $request->session()->get('success')]];
    }
}

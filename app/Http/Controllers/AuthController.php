<?php

namespace App\Http\Controllers;

use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Login', ['status' => session('status')]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['email' => 'required|email|max:255', 'password' => 'required|string|max:1024', 'remember' => 'sometimes|boolean']);
        $key = Str::lower($data['email']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw ValidationException::withMessages(['email' => 'Terlalu banyak percobaan. Coba kembali dalam '.RateLimiter::availableIn($key).' detik.']);
        }
        RateLimiter::hit($key, 60);

        try {
            $valid = Auth::attempt(['email' => $data['email'], 'password' => $data['password'], 'active' => true], $data['remember'] ?? false);
        } catch (QueryException) {
            Log::error('Penyimpanan tidak tersedia saat login.', ['request_id' => $request->attributes->get('request_id')]);

            return back()->with('status', 'Layanan penyimpanan belum tersedia. Login belum berhasil. Hubungi administrator dengan referensi '.$request->attributes->get('request_id').'.');
        }
        if (! $valid) {
            throw ValidationException::withMessages(['email' => 'Email atau kata sandi tidak valid.']);
        }
        RateLimiter::clear($key);
        $request->session()->regenerate();

        return redirect()->route('dashboard');
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}

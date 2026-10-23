<?php

use App\Http\Middleware\EnsureActiveUser;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RequestId;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', api: __DIR__.'/../routes/api.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(RequestId::class);
        $middleware->web(append: [HandleInertiaRequests::class]);
        $middleware->alias(['active' => EnsureActiveUser::class]);
        $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontReport(QueryException::class);
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());
        $exceptions->render(function (QueryException $exception, Request $request): mixed {
            $requestId = $request->attributes->get('request_id');
            Log::error('Penyimpanan tidak tersedia.', ['request_id' => $requestId, 'exception_type' => $exception::class]);
            $conflict = in_array($exception->errorInfo[0] ?? null, ['23000', '23505', '40001'], true);
            $status = $conflict ? 409 : 503;
            $message = $conflict ? 'Data berbenturan dengan perubahan lain. Muat ulang data terbaru sebelum mencoba kembali.' : 'Penyimpanan server belum tersedia. Permintaan belum berhasil; coba kembali atau hubungi administrator.';
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => $message, 'request_id' => $requestId], $status);
            }

            return Inertia::render('Error', ['status' => $status, 'message' => $message, 'requestId' => $requestId])->toResponse($request)->setStatusCode($status);
        });
        $exceptions->render(function (HttpException $exception, Request $request): mixed {
            $status = $exception->getStatusCode();
            if (! in_array($status, [403, 404, 409], true)) {
                return null;
            }
            $message = $status === 404 ? 'Halaman atau data yang diminta tidak ditemukan. Periksa alamat atau kembali ke halaman masuk.' : ($exception->getMessage() ?: 'Data yang diminta tidak tersedia untuk akun Anda.');
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json(['message' => $message, 'request_id' => $request->attributes->get('request_id')], $status);
            }

            return Inertia::render('Error', ['status' => $status, 'message' => $message, 'requestId' => $request->attributes->get('request_id')])->toResponse($request)->setStatusCode($status);
        });
        $exceptions->respond(function (Response $response): Response {
            $response->headers->set('X-Request-ID', request()->attributes->get('request_id', (string) Str::uuid()));

            return $response;
        });
    })->create();

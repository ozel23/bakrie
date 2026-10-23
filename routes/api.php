<?php

use App\Http\Controllers\Api\V1\OperationsController as Api;
use App\Http\Controllers\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('auth/login', [Api::class, 'login'])->middleware('throttle:5,1');
    Route::middleware(['auth:sanctum', 'active', 'throttle:120,1'])->group(function (): void {
        Route::get('me', [Api::class, 'me']);
        Route::post('auth/logout', [Api::class, 'logout']);
        Route::get('bootstrap', [Api::class, 'bootstrap']);
        Route::get('equipment/{equipment}', [Api::class, 'showEquipment']);
        Route::get('daily-reports/{report}', [Api::class, 'showReport']);
        Route::post('daily-reports', [Api::class, 'saveReport']);
        Route::patch('daily-reports/{report}', [Api::class, 'saveReport']);
        Route::post('daily-reports/{report}/fuel-verifications', [Api::class, 'fuel']);
        Route::post('daily-reports/{report}/{action}', [Api::class, 'transition'])->whereIn('action', ['submit', 'review', 'return', 'approve']);
        Route::post('breakdowns', [Api::class, 'breakdown']);
        Route::post('maintenance-orders', [Api::class, 'order']);
        Route::post('maintenance-orders/{order}/actions', [Api::class, 'maintenanceAction']);
        Route::post('maintenance-orders/{order}/release', [Api::class, 'release']);
        Route::post('sync/push', [Api::class, 'push']);
        Route::get('sync/pull', [Api::class, 'pull']);
        Route::get('dashboard', [Api::class, 'dashboard']);
        Route::post('attachments', [WorkspaceController::class, 'attach']);
        Route::get('attachments/{uuid}', [WorkspaceController::class, 'downloadAttachment']);
        Route::get('{resource}', [Api::class, 'index'])->whereIn('resource', ['daily-reports', 'assignments', 'breakdowns', 'maintenance-orders']);
    });
});

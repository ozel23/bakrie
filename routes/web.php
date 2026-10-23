<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');
Route::get('/login', [AuthController::class, 'create'])->name('login');
Route::post('/login', [AuthController::class, 'store'])->middleware('throttle:10,1');
Route::post('/logout', [AuthController::class, 'destroy'])->name('logout');
Route::middleware(['auth', 'active'])->group(function (): void {
    Route::get('/dashboard', fn () => redirect('/app/dashboard'))->name('dashboard');
    Route::get('/app/{page?}', [WorkspaceController::class, 'index'])->name('workspace');
    Route::post('/workspace/actions/{action}', [WorkspaceController::class, 'action']);
    Route::post('/workspace/report-preview', [WorkspaceController::class, 'previewDocument']);
    Route::post('/workspace/export', [WorkspaceController::class, 'export']);
    Route::post('/workspace/import', [WorkspaceController::class, 'import']);
    Route::post('/workspace/attachments', [WorkspaceController::class, 'attach']);
    Route::get('/attachments/{uuid}', [WorkspaceController::class, 'downloadAttachment'])->name('attachments.download');
});

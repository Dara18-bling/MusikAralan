<?php

use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatbotController;
use App\Http\Controllers\Api\ClassController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\LearningController;
use App\Http\Controllers\Api\QuizAttemptController;
use App\Http\Controllers\Api\ScheduleController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\UserNotificationController;
use App\Http\Controllers\Api\VoiceGroupController;
use Illuminate\Support\Facades\Route;

Route::get('/settings/appearance', [SettingController::class, 'appearance']);

Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:password-reset');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:password-reset');

Route::middleware(['auth:sanctum', 'app.user'])->group(function (): void {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/session', [AuthController::class, 'session']);

    Route::middleware('approved')->group(function (): void {
        Route::get('/me', [AuthController::class, 'me']);
        Route::patch('/me', [AuthController::class, 'updateProfile']);
        Route::patch('/me/phone', [AuthController::class, 'updatePhone']);
        Route::get('/dashboard', [DashboardController::class, 'show']);
        Route::get('/schedules', [ScheduleController::class, 'index']);
        Route::post('/schedules', [ScheduleController::class, 'store']);
        Route::get('/quiz-attempts', [QuizAttemptController::class, 'index']);
        Route::get('/notifications', [UserNotificationController::class, 'index']);
        Route::patch('/notifications/{notificationId}/read', [UserNotificationController::class, 'markRead']);

        Route::get('/classes', [ClassController::class, 'index']);
        Route::post('/classes/{class}/notifications', [UserNotificationController::class, 'notifyClass']);
        Route::get('/classes/{class}/enrollment-notice', [ClassController::class, 'enrollmentNotice']);
        Route::post('/classes/{class}/enroll', [ClassController::class, 'enrollment']);
        Route::get('/classes/{class}/students', [ClassController::class, 'students']);
        Route::get('/classes/{class}/materials', [LearningController::class, 'materials']);
        Route::post('/classes/{class}/materials', [LearningController::class, 'createMaterial']);
        Route::post('/classes/{class}/materials/{material}/complete', [LearningController::class, 'completeMaterial']);
        Route::get('/classes/{class}/progress', [LearningController::class, 'progress']);
        Route::get('/classes/{class}/assessment', [LearningController::class, 'assessment']);
        Route::put('/classes/{class}/assessment', [LearningController::class, 'publishAssessment']);
        Route::post('/classes/{class}/assessment/attempts', [LearningController::class, 'submitAssessment']);

        Route::get('/announcements', [AnnouncementController::class, 'index']);
        Route::get('/chatbot-responses', [ChatbotController::class, 'index']);
        Route::middleware('role:admin')->group(function (): void {
            Route::get('/voice-groups', [VoiceGroupController::class, 'index']);
            Route::post('/voice-groups', [VoiceGroupController::class, 'store']);
            Route::put('/voice-groups/{voiceGroup}', [VoiceGroupController::class, 'update']);
            Route::delete('/voice-groups/{voiceGroup}', [VoiceGroupController::class, 'destroy']);
            Route::put('/admin/users/{userId}/voice-groups', [VoiceGroupController::class, 'assignUsers'])->whereNumber('userId');
            Route::get('/admin/users', [AuthController::class, 'indexUsers']);
            Route::patch('/admin/users/{userId}', [AuthController::class, 'updateUser'])->whereNumber('userId');
            Route::post('/classes', [ClassController::class, 'store']);
            Route::put('/classes/{class}', [ClassController::class, 'update']);
            Route::post('/announcements', [AnnouncementController::class, 'store']);
            Route::put('/announcements/{id}', [AnnouncementController::class, 'update'])->whereNumber('id');
            Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy'])->whereNumber('id');
            Route::post('/chatbot-responses', [ChatbotController::class, 'store']);
            Route::put('/chatbot-responses/{id}', [ChatbotController::class, 'update']);
            Route::delete('/chatbot-responses/{id}', [ChatbotController::class, 'destroy']);
            Route::put('/settings/appearance', [SettingController::class, 'saveAppearance']);
        });
    });
});

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'phone_verified')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropColumn('phone_verified');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'phone_verified')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->boolean('phone_verified')->default(false);
            });
        }
    }
};

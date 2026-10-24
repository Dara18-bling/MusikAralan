<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gospel_verses', function (Blueprint $table) {
            $table->id();
            $table->string('book', 40);
            $table->unsignedSmallInteger('chapter');
            $table->unsignedSmallInteger('verse');
            $table->timestamps();
            $table->unique(['book', 'chapter', 'verse']);
        });

        $now = now();
        DB::table('gospel_verses')->insert([
            ['book' => 'john', 'chapter' => 3, 'verse' => 16, 'created_at' => $now, 'updated_at' => $now],
            ['book' => 'psalms', 'chapter' => 23, 'verse' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['book' => 'proverbs', 'chapter' => 3, 'verse' => 5, 'created_at' => $now, 'updated_at' => $now],
            ['book' => 'philippians', 'chapter' => 4, 'verse' => 13, 'created_at' => $now, 'updated_at' => $now],
            ['book' => 'romans', 'chapter' => 8, 'verse' => 28, 'created_at' => $now, 'updated_at' => $now],
            ['book' => 'matthew', 'chapter' => 5, 'verse' => 16, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('gospel_verses');
    }
};
